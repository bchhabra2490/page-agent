export interface SpeechRecognitionOptions {
	language?: string
	onTranscript: (text: string, isFinal: boolean) => void
	onStateChange?: (listening: boolean) => void
	onError?: (message: string) => void
}

interface BrowserSpeechRecognition extends EventTarget {
	lang: string
	continuous: boolean
	interimResults: boolean
	onstart: ((this: BrowserSpeechRecognition, ev: Event) => void) | null
	onend: ((this: BrowserSpeechRecognition, ev: Event) => void) | null
	onerror: ((this: BrowserSpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
	onresult: ((this: BrowserSpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
	start(): void
	stop(): void
	abort(): void
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition

declare global {
	interface Window {
		SpeechRecognition?: SpeechRecognitionConstructor
		webkitSpeechRecognition?: SpeechRecognitionConstructor
	}
}

export function isSpeechRecognitionSupported(): boolean {
	if (typeof window === 'undefined') return false
	return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
	return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

/**
 * Thin wrapper around the Web Speech API for panel voice input.
 */
export class SpeechInput {
	#recognition: BrowserSpeechRecognition | null = null
	#listening = false
	#baseText = ''
	#options: SpeechRecognitionOptions

	constructor(options: SpeechRecognitionOptions) {
		this.#options = options
	}

	get listening(): boolean {
		return this.#listening
	}

	start(baseText = ''): boolean {
		if (!isSpeechRecognitionSupported() || this.#listening) return false

		const SpeechRecognitionCtor = getSpeechRecognitionCtor()
		if (!SpeechRecognitionCtor) return false

		const recognition = new SpeechRecognitionCtor()
		recognition.lang = this.#options.language ?? document.documentElement.lang ?? 'en-US'
		recognition.continuous = true
		recognition.interimResults = true

		this.#baseText = baseText
		this.#recognition = recognition

		recognition.onstart = () => {
			this.#listening = true
			this.#options.onStateChange?.(true)
		}

		recognition.onend = () => {
			this.#listening = false
			this.#recognition = null
			this.#options.onStateChange?.(false)
		}

		recognition.onerror = (event) => {
			if (event.error === 'aborted') return
			this.#options.onError?.(event.error)
		}

		recognition.onresult = (event) => {
			let transcript = ''
			for (const result of event.results) {
				transcript += result[0].transcript
			}
			const prefix = this.#baseText
			const combined = prefix ? `${prefix} ${transcript}`.trim() : transcript.trim()
			const isFinal = event.results[event.results.length - 1]?.isFinal ?? false
			this.#options.onTranscript(combined, isFinal)
		}

		try {
			recognition.start()
			return true
		} catch {
			this.#recognition = null
			this.#listening = false
			return false
		}
	}

	stop(): void {
		this.#recognition?.stop()
	}

	dispose(): void {
		this.#recognition?.abort()
		this.#recognition = null
		this.#listening = false
	}
}
