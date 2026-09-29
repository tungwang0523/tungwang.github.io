import dimensions from '../data/image-dimensions.json' with { type: 'json' };

export const imageDimensionsFor = (source) => dimensions[source] ?? undefined;
