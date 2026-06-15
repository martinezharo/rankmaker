import type { Dict } from './locales/en';

type DeepLoose<T> = {
	[K in keyof T]?: T[K] extends string ? string : T[K] extends object ? DeepLoose<T[K]> : T[K];
};

/** Shape every locale file conforms to (a partial mirror of the English dict). */
export type LocaleDict = DeepLoose<Dict>;
