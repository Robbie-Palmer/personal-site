import { imageUrl } from "../lib/data";

interface ImagePanelProps {
  imagePaths: string[];
  onClickImage?: (index: number) => void;
}

export function ImagePanel({ imagePaths, onClickImage }: ImagePanelProps) {
  return (
    <div
      className={`grid gap-4 ${imagePaths.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
    >
      {imagePaths.map((path, i) => (
        <div
          key={path}
          className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200"
        >
          <img
            src={imageUrl(path)}
            alt=""
            className={`w-full h-auto max-h-[500px] object-contain ${
              onClickImage ? "cursor-zoom-in" : ""
            }`}
            onClick={onClickImage ? () => onClickImage(i) : undefined}
          />
        </div>
      ))}
    </div>
  );
}
