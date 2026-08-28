// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import TemplateCard, { type CardTemplate } from './TemplateCard';
import { inlineDictionary, render, screen } from '../test/dom';

const template = (overrides: Partial<CardTemplate> = {}): CardTemplate => ({
	slug: 'best-movies',
	title: 'Best Movies',
	description: 'The best films ever made.',
	category: 'Movies',
	cover_image: 'https://img.test/cover.webp',
	times_ranked: 1234,
	votes: 7,
	creator: { username: 'alice', avatar: 'star-purple', isVerified: false },
	...overrides,
});

describe('TemplateCard', () => {
	it('links to the template and shows its title', () => {
		render(<TemplateCard template={template()} />);
		expect(screen.getByRole('link')).toHaveAttribute(
			'href',
			'/template/best-movies'
		);
		expect(screen.getByRole('heading')).toHaveTextContent('Best Movies');
	});

	it('prefixes the link for a translated locale', () => {
		render(<TemplateCard template={template()} locale="es" />);
		expect(screen.getByRole('link')).toHaveAttribute(
			'href',
			'/es/template/best-movies'
		);
	});

	it('encodes a slug that would otherwise break the URL', () => {
		render(<TemplateCard template={template({ slug: 'a b&c' })} />);
		expect(screen.getByRole('link')).toHaveAttribute('href', '/template/a b&c');
	});

	it('shows the live counts, formatted for reading', () => {
		inlineDictionary();
		render(<TemplateCard template={template()} />);
		expect(
			document.querySelector('[data-count-slug="best-movies"]')
		).toHaveTextContent('1,234');
		expect(
			document.querySelector('[data-vote-slug="best-movies"]')
		).toHaveTextContent('7');
	});

	it('shows zero votes when the template has none', () => {
		render(<TemplateCard template={template({ votes: undefined })} />);
		expect(
			document.querySelector('[data-vote-slug="best-movies"]')
		).toHaveTextContent('0');
	});

	it('credits the creator and points at their profile', () => {
		render(<TemplateCard template={template()} />);
		expect(screen.getByText('@alice')).toBeInTheDocument();
		expect(document.querySelector('.creator-link')).toHaveAttribute(
			'data-profile-href',
			'/u/alice'
		);
	});

	it('percent-encodes a username in the profile link', () => {
		render(
			<TemplateCard
				template={template({
					creator: { username: 'a b', avatar: 'star-purple', isVerified: false },
				})}
			/>
		);
		expect(document.querySelector('.creator-link')).toHaveAttribute(
			'data-profile-href',
			'/u/a%20b'
		);
	});

	it('omits the creator block for a template with no creator', () => {
		render(<TemplateCard template={template({ creator: undefined })} />);
		expect(document.querySelector('.creator-link')).toBeNull();
	});

	it('omits the description and the category badge when there are none', () => {
		render(
			<TemplateCard
				template={template({ description: null, category: null })}
			/>
		);
		expect(screen.queryByText('The best films ever made.')).toBeNull();
		expect(document.querySelector('[data-rm-tip-placement="bottom"] .fa-film'))
			.toBeNull();
	});

	it('carries the hooks the save and share scripts bind to', () => {
		render(<TemplateCard template={template()} />);
		const save = document.querySelector('.save-btn')!;
		const share = document.querySelector('.share-btn')!;
		expect(save).toHaveAttribute('data-slug', 'best-movies');
		expect(save).toHaveAttribute('data-save-aria');
		expect(save).toHaveAttribute('data-unsave-aria');
		expect(share).toHaveAttribute('data-slug', 'best-movies');
		expect(share).toHaveAttribute('data-title', 'Best Movies');
	});

	it('renders the requested heading level for the page outline', () => {
		const { container } = render(
			<TemplateCard template={template()} headingLevel="h2" />
		);
		expect(container.querySelector('h2')).toHaveTextContent('Best Movies');
	});

	it('defaults to h3, the level a listing section needs', () => {
		const { container } = render(<TemplateCard template={template()} />);
		expect(container.querySelector('h3')).toHaveTextContent('Best Movies');
	});

	it('renders a hostile title as text, never as markup', () => {
		render(
			<TemplateCard
				template={template({ title: '<img src=x onerror=alert(1)>' })}
			/>
		);
		expect(document.querySelector('img[src="x"]')).toBeNull();
		expect(screen.getByRole('heading')).toHaveTextContent(
			'<img src=x onerror=alert(1)>'
		);
	});
});
