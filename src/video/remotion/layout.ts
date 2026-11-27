// The plan's geometry for every component of a render (set once in CutVideo from plan.layout).
import { createContext, useContext } from 'react';
import { LANDSCAPE, type Geometry } from '../geometry';

export const GeometryContext = createContext<Geometry>(LANDSCAPE);
export const useGeometry = () => useContext(GeometryContext);
/** A frame taller than it is wide: scenes stack their parts instead of placing them side by side. */
export const isTall = (g: Geometry) => g.OUT.h > g.OUT.w;
