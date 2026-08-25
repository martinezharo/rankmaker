/**
 * Client behaviour for <Select> (src/components/ui/Select.astro).
 *
 * The markup ships a real <select> (visually hidden) plus a listbox rendered
 * server-side. This turns the listbox into a working combobox and mirrors every
 * choice back onto the native element, so consumers keep using the plain DOM
 * API — `select.value`, `select.selectedOptions`, `change` events — and nothing
 * else in the app needs to know the control is custom.
 */

import { createDropdown } from "./dropdown";
import { SELECT_SYNC_EVENT, setSelectValue } from "./select-sync";

// Re-exported so consumers keep a single import for the control's API.
export { setSelectValue };

const BOUND = "rmSelectBound";

export function initSelects(root: ParentNode = document): void {
	root.querySelectorAll<HTMLElement>("[data-rm-select]").forEach(enhance);
}

function enhance(root: HTMLElement): void {
	if (root.dataset[BOUND]) return;

	const native = root.querySelector<HTMLSelectElement>(".rm-select-native");
	const trigger = root.querySelector<HTMLButtonElement>(".rm-select-trigger");
	const popover = root.querySelector<HTMLElement>(".rm-select-popover");
	const list = root.querySelector<HTMLElement>(".rm-select-list");
	if (!native || !trigger || !popover || !list) return;
	root.dataset[BOUND] = "1";

	const valueIcon = root.querySelector<HTMLElement>(".rm-select-icon");
	const valueText = root.querySelector<HTMLElement>(".rm-select-text");
	const search = root.querySelector<HTMLInputElement>(".rm-select-search-input");
	const empty = root.querySelector<HTMLElement>(".rm-select-empty");
	const allOptions = Array.from(
		list.querySelectorAll<HTMLElement>(".rm-select-option"),
	);
	const placeholder = trigger.dataset.placeholder ?? "";
	const placeholderIcon = trigger.dataset.placeholderIcon ?? "";

	let active: HTMLElement | null = null;

	const isSelectable = (option: HTMLElement) =>
		option.getAttribute("aria-disabled") !== "true" && !option.hidden;

	const visibleOptions = () => allOptions.filter(isSelectable);

	const optionFor = (value: string) =>
		allOptions.find((option) => option.dataset.value === value) ?? null;

	/** Repaint the trigger and the checkmarks from the native select's value. */
	function render() {
		const value = native!.value;
		const option = optionFor(value);
		for (const item of allOptions) {
			item.setAttribute(
				"aria-selected",
				String(item.dataset.value === value && option !== null),
			);
		}

		const icon = option?.dataset.icon || placeholderIcon;
		if (valueIcon) {
			valueIcon.className = icon
				? `fa-solid ${icon} rm-select-icon`
				: "rm-select-icon";
			valueIcon.hidden = !icon;
		}
		if (valueText) {
			valueText.textContent = option
				? (option.dataset.label ?? option.textContent ?? "").trim()
				: placeholder;
			valueText.classList.toggle("rm-select-text-placeholder", !option);
		}
	}

	function select(option: HTMLElement) {
		const value = option.dataset.value ?? "";
		const changed = native!.value !== value;
		native!.value = value;
		render();
		if (changed) {
			native!.dispatchEvent(new Event("input", { bubbles: true }));
			native!.dispatchEvent(new Event("change", { bubbles: true }));
		}
	}

	function setActive(option: HTMLElement | null) {
		if (active && active !== option) active.classList.remove("is-active");
		active = option;
		const focused = search ?? trigger!;
		if (!option) {
			focused.removeAttribute("aria-activedescendant");
			return;
		}
		option.classList.add("is-active");
		focused.setAttribute("aria-activedescendant", option.id);
		option.scrollIntoView({ block: "nearest" });
	}

	function filter(query: string) {
		const needle = query.trim().toLowerCase();
		for (const option of allOptions) {
			const haystack = `${option.dataset.label ?? ""} ${option.dataset.hint ?? ""}`;
			option.hidden = needle !== "" && !haystack.toLowerCase().includes(needle);
		}
		const visible = visibleOptions();
		if (empty) empty.hidden = visible.length > 0;
		setActive(visible[0] ?? null);
	}

	const dropdown = createDropdown({
		root,
		trigger,
		popover,
		items: visibleOptions,
		activate: (option) => {
			select(option);
			dropdown.close();
			trigger.focus();
		},
		setActive,
		getActive: () => active,
		focusTarget: () => search ?? trigger,
		// Typeahead is redundant when a filter input is present.
		textOf: search ? undefined : (option) => option.dataset.label ?? "",
		onOpen: () => {
			if (search) {
				search.value = "";
				filter("");
			}
			setActive(optionFor(native.value) ?? visibleOptions()[0] ?? null);
		},
	});

	list.addEventListener("click", (event) => {
		const option = (event.target as HTMLElement).closest<HTMLElement>(
			".rm-select-option",
		);
		if (!option || !isSelectable(option)) return;
		select(option);
		dropdown.close();
		trigger.focus();
	});

	list.addEventListener("pointermove", (event) => {
		const option = (event.target as HTMLElement).closest<HTMLElement>(
			".rm-select-option",
		);
		if (option && isSelectable(option) && option !== active) setActive(option);
	});

	// Mobile sheet: tapping the dimmed backdrop (the popover's own ::before)
	// dismisses. Outside-click detection can't see it — it lives inside `root`.
	popover.addEventListener("click", (event) => {
		if (event.target === popover) dropdown.close();
	});

	search?.addEventListener("input", () => filter(search.value));

	// Keep the trigger in sync when other code changes the value (a reset, a
	// prefilled draft, a dispatched `change`) — our own updates render first, so
	// this is a no-op for them.
	native.addEventListener("change", render);
	native.addEventListener(SELECT_SYNC_EVENT, render);

	render();
}
