import { imageUrl } from "../lib/data";

interface ImagePanelProps {
  imagePaths: string[];
  onClickImage?: (index: number) => void;
}

export function ImagePanel({ imagePaths, onClickImage }: Readonly<ImagePanelProps>) {
  return (
    <div
      className={`grid gap-4 ${imagePaths.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
    >
      {imagePaths.map((path, i) => (
        <div
          key={path}
          className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200"
        >
          {onClickImage ? (
            <button
              type="button"
              className="block w-full cursor-zoom-in"
              onClick={() => onClickImage(i)}
              aria-label={`Open image ${i + 1} at full size`}
            >
              <img
                src={imageUrl(path)}
                alt=""
                className="w-full h-auto max-h-[500px] object-contain"
              />
            </button>
          ) : (
            <img
              src={imageUrl(path)}
              alt=""
              className="w-full h-auto max-h-[500px] object-contain"
            />
          )}
        </div>
      ))}
    </div>
  );
}
