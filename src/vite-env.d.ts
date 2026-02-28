/// <reference types="vite/client" />

declare module 'react-slick' {
  import { Component } from 'react';
  export interface Settings {
    dots?: boolean;
    infinite?: boolean;
    speed?: number;
    slidesToShow?: number;
    slidesToScroll?: number;
    autoplay?: boolean;
    autoplaySpeed?: number;
    arrows?: boolean;
    pauseOnHover?: boolean;
    fade?: boolean;
    cssEase?: string;
    beforeChange?: (current: number, next: number) => void;
    afterChange?: (current: number) => void;
    swipe?: boolean;
    swipeToSlide?: boolean;
    touchThreshold?: number;
    variableWidth?: boolean;
    centerMode?: boolean;
    centerPadding?: string;
    adaptiveHeight?: boolean;
    className?: string;
    responsive?: Array<{
      breakpoint: number;
      settings: Partial<Settings>;
    }>;
    [key: string]: any;
  }
  export default class Slider extends Component<Settings & { children?: React.ReactNode }> {}
}

declare module 'slick-carousel/slick/slick.css' {
  const content: string;
  export default content;
}

declare module 'slick-carousel/slick/slick-theme.css' {
  const content: string;
  export default content;
}

declare module 'figma:asset/*' {
  const src: string;
  export default src;
}
