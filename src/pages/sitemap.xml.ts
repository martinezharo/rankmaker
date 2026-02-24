import templates from "../data/templates.json";

const SITE_URL = "https://rankmaker.net";

export async function GET() {
    const pages = [
        "",
        "/search",
        "/about",
        "/contact",
        "/cookie-policy",
        "/legal-notice",
        "/privacy-policy",
        "/terms-of-use",
    ];

    const templatePages = templates.map((t) => `/template/${t.slug}`);

    // Helper to determine priority
    const getPriority = (page: string) => {
        if (page === "") return "1.0";
        if (page.startsWith("/template/")) return "0.9";
        if (page === "/search") return "0.8";
        return "0.3"; // Lower priority for legal/contact/info pages
    };

    // Helper to determine changefreq
    const getChangeFreq = (page: string) => {
        if (page === "" || page === "/search") return "daily";
        if (page.startsWith("/template/")) return "weekly";
        return "monthly";
    };

    const allPages = [...pages, ...templatePages];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${allPages
            .map(
                (page) => `
  <url>
    <loc>${SITE_URL}${page}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>${getChangeFreq(page)}</changefreq>
    <priority>${getPriority(page)}</priority>
  </url>`,
            )
            .join("")}
</urlset>`;

    return new Response(sitemap, {
        headers: {
            "Content-Type": "application/xml",
        },
    });
}
