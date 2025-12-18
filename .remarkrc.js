export default {
  plugins: [
    'remark-gfm',
    'remark-frontmatter',
    'remark-mdx',
    'remark-preset-lint-recommended',
    ['remark-lint-list-item-indent', false],
  ],
};
