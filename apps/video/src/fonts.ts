import {loadFont} from '@remotion/fonts';
import {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';

export const MEMOO_FONT_FAMILY = 'VAG Rounded';

let fontLoadPromise: Promise<void> | null = null;

const ensureFonts = () => {
  if (!fontLoadPromise) {
    fontLoadPromise = Promise.all([
      loadFont({
        family: MEMOO_FONT_FAMILY,
        url: staticFile('fonts/vag-rounded-thin.ttf'),
        weight: '200',
      }),
      loadFont({
        family: MEMOO_FONT_FAMILY,
        url: staticFile('fonts/vag-rounded-light.ttf'),
        weight: '400',
      }),
      loadFont({
        family: MEMOO_FONT_FAMILY,
        url: staticFile('fonts/vag-rounded-bold.ttf'),
        weight: '700',
      }),
      loadFont({
        family: MEMOO_FONT_FAMILY,
        url: staticFile('fonts/vag-rounded-black.ttf'),
        weight: '900',
      }),
    ]).then(() => undefined);
  }

  return fontLoadPromise;
};

export const useMemooFonts = () => {
  const [handle] = useState(() => delayRender('Loading Memoo fonts'));

  useEffect(() => {
    let mounted = true;

    ensureFonts()
      .then(() => {
        if (mounted) {
          continueRender(handle);
        }
      })
      .catch((error) => {
        if (mounted) {
          cancelRender(error);
        }
      });

    return () => {
      mounted = false;
    };
  }, [handle]);
};
