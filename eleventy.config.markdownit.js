

const markdownItFootnote = require("markdown-it-footnote");

module.exports = function(eleventyConfig) {
  // New in 2.0
  eleventyConfig.amendLibrary("md", mdLib => mdLib.use(markdownItFootnote));
};

