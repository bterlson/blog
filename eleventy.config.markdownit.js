
module.exports = function(eleventyConfig) {
  // New in 2.0
  eleventyConfig.amendLibrary("md", mdLib => {
    mdLib.use(require("markdown-it-footnote"));
    mdLib.use(require("markdown-it-table-of-contents"), {
      listType: "ol",
      includeLevel: [1,2,3,4]
    })
  });
};

