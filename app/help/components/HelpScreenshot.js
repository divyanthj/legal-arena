import Image from "next/image";

export default function HelpScreenshot({ src, alt, title, caption }) {
  return (
    <figure className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-black/35 shadow-2xl shadow-black/25">
      <div className="border-b border-white/10 px-4 py-3 sm:px-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/72">
          {title}
        </p>
      </div>
      <div className="relative aspect-[16/9] overflow-hidden bg-black">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 900px"
          className="object-cover object-top"
        />
      </div>
      <figcaption className="border-t border-white/10 px-4 py-3 text-sm leading-6 text-white/58 sm:px-5">
        {caption}
      </figcaption>
    </figure>
  );
}
