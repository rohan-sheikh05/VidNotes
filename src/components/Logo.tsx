import lockupLight from '../assets/brand/vidnotes-horizontal.svg';
import lockupDark from '../assets/brand/vidnotes-horizontal-dark.svg';

/**
 * Horizontal VidNotes lockup. Masters live in brand/logo (rebuild with brand/build_logo.py);
 * the light/dark files swap with the app theme (`dark` class on <html>).
 */
export default function Logo({ className = 'h-7' }: { className?: string }) {
  return (
    <span className="inline-flex">
      <img src={lockupLight} alt="VidNotes" className={`${className} w-auto dark:hidden`} />
      <img src={lockupDark} alt="VidNotes" className={`${className} hidden w-auto dark:block`} />
    </span>
  );
}
