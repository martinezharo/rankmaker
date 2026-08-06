/**
 * Shared dropdown behaviour: open/close state, outside-click and Escape
 * dismissal, arrow-key navigation, type-to-jump and flip-up placement.
 *
 * Both the custom <Select> component and the footer language switcher build on
 * this, so every popover in the app opens, closes and responds to the keyboard
 * the same way. Only one dropdown can be open at a time.
 */

export interface DropdownConfig {
	/** Wrapper used for outside-click detection and open-state classes. */
	root: HTMLElement;
	trigger: HTMLElement;
	/** Element toggled via the `hidden` attribute. */
	popover: HTMLElement;
	/** Navigable items, in visual order (filtered lists return fewer). */
	items: () => HTMLElement[];
	/** Commit an item — Enter or click. */
	activate: (item: HTMLElement) => void;
	/** Reflect the highlighted item (roving focus or aria-activedescendant). */
	setActive: (item: HTMLElement | null) => void;
	/** Highlighted item, used as the starting point for arrow navigation. */
	getActive?: () => HTMLElement | null;
	/** Element that should hold DOM focus while open (defaults to the trigger). */
	focusTarget?: () => HTMLElement | null;
	/** Text used for type-to-jump; omit to disable it. */
	textOf?: (item: HTMLElement) => string;
	onOpen?: () => void;
	onClose?: () => void;
}

export interface Dropdown {
	open(): void;
	close(): void;
	toggle(): void;
	isOpen(): boolean;
}

/** The single dropdown currently open, if any. */
let current: Dropdown | null = null;

/** Minimum room (px) a dropdown wants below the trigger before flipping up. */
const MIN_SPACE = 240;

export function closeOpenDropdown(): void {
	current?.close();
}

export function createDropdown(config: DropdownConfig): Dropdown {
	const { root, trigger, popover } = config;
	let open = false;
	let typeahead = "";
	let typeaheadTimer = 0;

	function focusTarget(): HTMLElement {
		return config.focusTarget?.() ?? trigger;
	}

	// Flip the popover above the trigger when the viewport has more room there,
	// and cap its height to the available space so long lists scroll instead of
	// spilling off-screen. The mobile sheet styling overrides both in CSS.
	function place() {
		const rect = trigger.getBoundingClientRect();
		const below = window.innerHeight - rect.bottom;
		const above = rect.top;
		const up = below < MIN_SPACE && above > below;
		root.classList.toggle("rm-dd-up", up);
		popover.style.setProperty(
			"--rm-dd-max-h",
			`${Math.max(160, Math.round((up ? above : below) - 16))}px`,
		);
	}

	function onOutside(event: Event) {
		if (!root.contains(event.target as Node)) close();
	}

	function onViewportChange() {
		place();
	}

	function open_() {
		if (open) return;
		current?.close();
		open = true;
		current = api;
		popover.hidden = false;
		root.classList.add("rm-dd-open");
		trigger.setAttribute("aria-expanded", "true");
		place();
		document.addEventListener("pointerdown", onOutside, true);
		window.addEventListener("resize", onViewportChange);
		window.addEventListener("scroll", onViewportChange, true);
		config.onOpen?.();
		focusTarget().focus();
		const active = config.getActive?.() ?? null;
		config.setActive(active ?? config.items()[0] ?? null);
	}

	function close() {
		if (!open) return;
		open = false;
		if (current === api) current = null;
		popover.hidden = true;
		root.classList.remove("rm-dd-open", "rm-dd-up");
		trigger.setAttribute("aria-expanded", "false");
		document.removeEventListener("pointerdown", onOutside, true);
		window.removeEventListener("resize", onViewportChange);
		window.removeEventListener("scroll", onViewportChange, true);
		config.setActive(null);
		config.onClose?.();
	}

	function move(delta: number) {
		const items = config.items();
		if (items.length === 0) return;
		const active = config.getActive?.() ?? null;
		const from = active ? items.indexOf(active) : -1;
		const next =
			from === -1
				? delta > 0
					? 0
					: items.length - 1
				: Math.min(items.length - 1, Math.max(0, from + delta));
		config.setActive(items[next]!);
	}

	function jumpTo(char: string) {
		if (!config.textOf) return;
		window.clearTimeout(typeaheadTimer);
		typeahead += char.toLowerCase();
		typeaheadTimer = window.setTimeout(() => (typeahead = ""), 600);
		const items = config.items();
		const match = items.find((item) =>
			config.textOf!(item).toLowerCase().startsWith(typeahead),
		);
		if (match) config.setActive(match);
	}

	function onKeydown(event: KeyboardEvent) {
		// Space must stay typable inside a filter input.
		const typing =
			event.target instanceof HTMLInputElement ||
			event.target instanceof HTMLTextAreaElement;

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				open ? move(1) : open_();
				return;
			case "ArrowUp":
				event.preventDefault();
				open ? move(-1) : open_();
				return;
			case "Home":
				if (!open) return;
				event.preventDefault();
				config.setActive(config.items()[0] ?? null);
				return;
			case "End": {
				if (!open) return;
				event.preventDefault();
				const items = config.items();
				config.setActive(items[items.length - 1] ?? null);
				return;
			}
			case "Enter":
			case " ": {
				if (event.key === " " && typing && open) return;
				if (!open) {
					event.preventDefault();
					open_();
					return;
				}
				const active = config.getActive?.() ?? null;
				if (active) {
					event.preventDefault();
					config.activate(active);
				}
				return;
			}
			case "Escape":
				if (!open) return;
				event.preventDefault();
				close();
				trigger.focus();
				return;
			case "Tab":
				close();
				return;
			default:
				if (
					!typing &&
					config.textOf &&
					event.key.length === 1 &&
					!event.metaKey &&
					!event.ctrlKey &&
					!event.altKey
				) {
					if (!open) open_();
					jumpTo(event.key);
				}
		}
	}

	const api: Dropdown = {
		open: open_,
		close,
		toggle: () => (open ? close() : open_()),
		isOpen: () => open,
	};

	trigger.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		api.toggle();
	});
	root.addEventListener("keydown", onKeydown);

	return api;
}

// Any navigation closes whatever is open: the header and footer persist across
// view transitions, so a popover left open would survive into the next page.
document.addEventListener("astro:before-swap", closeOpenDropdown);
