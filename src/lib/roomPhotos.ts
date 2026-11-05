/**
 * Optional product photos for Room Studio. A product listed here is shown as a standing cut-out photo
 * instead of the built-in 3D model. If the file is missing (for example on a deployment that does not
 * ship the photos), Room Studio quietly falls back to the 3D model.
 *
 * The files live in public/room-photos and are git-ignored on purpose: they are third-party product
 * photos used for local experiments.
 */
export const ROOM_PHOTOS: Record<string, string> = {
  "p-sofa-3": "/room-photos/sofa3.png",
  "p-sofa-2": "/room-photos/loveseat.png",
  "p-bed-single": "/room-photos/bed1.png",
  "p-bed-queen": "/room-photos/bed2.png",
  "p-dining-4": "/room-photos/dining.png",
  "p-desk": "/room-photos/desk.png",
  "p-wardrobe": "/room-photos/wardrobe.png",
  "p-chair": "/room-photos/chair.png",
  "p-shelf": "/room-photos/shelf.png",
};

/**
 * Size of the standing photo in feet. The photo is a three-quarter view, so it is a little wider than the
 * piece's floor width. Tall, narrow pieces are fitted by height instead.
 */
export function photoSize(aspect: number, dims: { w: number; h: number }) {
  const h = Math.min((dims.w * 1.15) / aspect, dims.h * 1.1);
  return { w: h * aspect, h };
}
