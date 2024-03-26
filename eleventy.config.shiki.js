
const theme = 'rose-pine-dawn';
const langs = [
  "typescript",
  JSON.parse(require("fs").readFileSync("./typespec.json")),
  "yaml"
]
module.exports = (eleventyConfig) => {
  // empty call to notify 11ty that we use this feature
  // eslint-disable-next-line no-empty-function
  eleventyConfig.amendLibrary('md', () => {});

  eleventyConfig.on('eleventy.before', async () => {
    const shiki = await import("shiki");
    const highlighter = await shiki.getHighlighter({themes: [theme], langs});

    eleventyConfig.amendLibrary('md', (mdLib) =>
      mdLib.set({
        highlight: (code, lang) => highlighter.codeToHtml(code.trim(), { lang, theme }),
      })
    );
  });
};