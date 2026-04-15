declare module "react-simple-maps" {
  import { ComponentType, ReactNode, SVGProps, MouseEvent } from "react";

  export interface ProjectionConfig {
    scale?: number;
    center?: [number, number];
    rotate?: [number, number, number];
    parallels?: [number, number];
    precision?: number;
  }

  export interface ComposableMapProps {
    projection?: string;
    projectionConfig?: ProjectionConfig;
    width?: number;
    height?: number;
    style?: React.CSSProperties;
    className?: string;
    children?: ReactNode;
  }

  export const ComposableMap: ComponentType<ComposableMapProps>;

  export interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    translateExtent?: [[number, number], [number, number]];
    onMoveStart?: (position: { coordinates: [number, number]; zoom: number }) => void;
    onMove?: (position: { coordinates: [number, number]; zoom: number; dragging: boolean }) => void;
    onMoveEnd?: (position: { coordinates: [number, number]; zoom: number }) => void;
    className?: string;
    style?: React.CSSProperties;
    children?: ReactNode;
  }

  export const ZoomableGroup: ComponentType<ZoomableGroupProps>;

  export interface GeographiesRenderProps {
    geographies: Geography[];
    loading: boolean;
    error: Error | null;
  }

  export interface GeographiesProps {
    geography: string | object;
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    parseGeographies?: (geographies: Geography[]) => Geography[];
    children: (props: GeographiesRenderProps) => ReactNode;
  }

  export const Geographies: ComponentType<GeographiesProps>;

  export interface Geography {
    rsmKey: string;
    id: string | number;
    properties: Record<string, unknown>;
    geometry: object;
  }

  export interface GeographyStyle {
    default?: React.CSSProperties;
    hover?: React.CSSProperties;
    pressed?: React.CSSProperties;
  }

  export interface GeographyProps extends Omit<SVGProps<SVGPathElement>, "style"> {
    geography: Geography;
    style?: GeographyStyle;
    onMouseEnter?: (event: MouseEvent<SVGPathElement>) => void;
    onMouseLeave?: (event: MouseEvent<SVGPathElement>) => void;
    onMouseMove?: (event: MouseEvent<SVGPathElement>) => void;
    onClick?: (event: MouseEvent<SVGPathElement>) => void;
  }

  export const Geography: ComponentType<GeographyProps>;

  export interface MarkerProps {
    coordinates: [number, number];
    className?: string;
    style?: React.CSSProperties;
    children?: ReactNode;
  }

  export const Marker: ComponentType<MarkerProps>;

  export interface LineProps {
    from: [number, number];
    to: [number, number];
    coordinates?: Array<[number, number]>;
    className?: string;
    style?: GeographyStyle;
  }

  export const Line: ComponentType<LineProps>;
}
