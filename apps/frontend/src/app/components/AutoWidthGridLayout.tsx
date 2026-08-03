"use client";
import type { ReactNode } from "react";
import ReactGridLayout, { type GridLayoutProps, useContainerWidth } from "react-grid-layout";

/**
 * Width-measuring wrapper around react-grid-layout.
 *
 * react-grid-layout v2 removed the `WidthProvider(ReactGridLayout)` HOC that both
 * dashboard grids used, replacing it with the `useContainerWidth` hook — which needs
 * a ref on a real wrapper element, so it cannot be applied as a drop-in HOC. This
 * component restores the old ergonomics: pass the same props as before (now in v2's
 * nested `gridConfig`/`dragConfig`/`resizeConfig` shape) and the width is measured
 * for you.
 *
 * The grid is not rendered until the container has been measured (`mounted`). Passing
 * width=0 on the first paint makes every item compute a zero-width position and then
 * visibly jump once the real measurement lands.
 */
export const AutoWidthGridLayout = ({
  children,
  ...props
}: Omit<GridLayoutProps, "width"> & { children?: ReactNode }) => {
  const { width, mounted, containerRef } = useContainerWidth();

  return (
    <div ref={containerRef}>
      {mounted && (
        <ReactGridLayout {...props} width={width}>
          {children}
        </ReactGridLayout>
      )}
    </div>
  );
};
