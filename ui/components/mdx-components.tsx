// biome-ignore lint/suspicious/noExplicitAny: MDX components can accept any props
type MDXComponents = Record<string, React.ComponentType<any>>;

export function useMDXComponents(
  components: MDXComponents = {},
): MDXComponents {
  return {
    ...components,
  };
}
