// Unsharp mask filter
//
// http://stackoverflow.com/a/23322820/1031804
// USM(O) = O + (2 * (Amount / 100) * (O - GB))
// GB - gaussial blur.
//
// brightness = 0.299*R + 0.587*G + 0.114*B
// http://stackoverflow.com/a/596243/1031804
//
// To simplify math, normalize brighness mutipliers to 2^16:
//
// brightness = (19595*R + 38470*G + 7471*B) / 65536

'use strict';

var fastblur = require('./blur');

function clampTo8(i) { return i < 0 ? 0 : (i > 255 ? 255 : i); }

// Convert image to greyscale, 32bits FP result (16.16)
function greyscale(src, srcW, srcH) {
  var size = srcW * srcH;
  var result = new Uint8Array(size); // We don't use sign, but that helps to JIT
  var i, srcPtr;

  for (i = 0, srcPtr = 0; i < size; i++) {
    result[i] = (src[srcPtr + 2] * 7471       // blue
               + src[srcPtr + 1] * 38470      // green
               + src[srcPtr] * 19595) >>> 16;  // red
    srcPtr = (srcPtr + 4)|0;
  }

  return result;
}

// Apply unsharp mask to src
//
// NOTE: radius is ignored to simplify gaussian blur calculation
// on practice we need radius 0.3..2.0. Use 1.0 now.
//
function unsharp(src, srcW, srcH, amount, radius, threshold) {
  var x, y, c, diff = 0, srcPtr, corr;

  var AMOUNT_NORM = amount / 250;

  // Convert to grayscale:
  //
  // - prevent color drift
  // - speedup blur calc
  //
  var gs = greyscale(src, srcW, srcH);
  var gsPtr = 0;

  // TODO make possible to change the blur parameter
  var blurred = fastblur(gs, srcW, srcH, 3, 3);

  for (y = 0; y < srcH; y++) {
    for (x = 0; x < srcW; x++) {

      // calculate brightness blur, difference & update source buffer
      diff = (gs[gsPtr] - (blurred[gsPtr++]))|0;

      // Update source image if thresold exceeded
      if (Math.abs(diff) > threshold) {
        // Calculate correction multiplier
        corr = diff * AMOUNT_NORM;
        srcPtr = (x + y * srcW) * 4;

        c = src[srcPtr];
        src[srcPtr++] = clampTo8(c + corr|0);
        c = src[srcPtr];
        src[srcPtr++] = clampTo8(c + corr|0);
        c = src[srcPtr];
        src[srcPtr]   = clampTo8(c + corr|0);
      }

    } // end row
  } // end column
}


module.exports = unsharp;
