"""Decode and normalize item photographs before storage or model input."""
from io import BytesIO
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener

from ..errors import AppError as TradeError

register_heif_opener()

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_PIXELS = 200_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


def normalize_image(data, content_type):
    # Phone JPEGs can contain auxiliary HDR/depth frames and be identified as MPO.
    allowed = {'JPEG', 'MPO', 'PNG', 'WEBP', 'HEIF'}
    if len(data) > MAX_UPLOAD_BYTES:
        raise TradeError('Choose a photo smaller than 25 MB.', 'IMAGE_TOO_LARGE', 413)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as source:
                # Decode the contents. Phone browsers can omit or mislabel the MIME type.
                if source.format not in allowed:
                    raise ValueError('Unsupported image type')
                source.seek(0)
                if source.width * source.height > MAX_PIXELS or min(source.size) < 32:
                    raise ValueError('Unsupported image dimensions')
                # JPEG decoder downsampling keeps high-resolution camera uploads inexpensive.
                source.draft('RGB', (1600, 1600))
                source.thumbnail((1600, 1600))
                image = ImageOps.exif_transpose(source)
                clean = Image.new('RGB', image.size, 'white')
                if image.mode in {'RGBA', 'LA'} or 'transparency' in image.info:
                    rgba = image.convert('RGBA')
                    clean.paste(rgba, mask=rgba.getchannel('A'))
                else:
                    clean.paste(image.convert('RGB'))
                output = BytesIO()
                clean.save(output, format='JPEG', quality=88)
                return output.getvalue(), clean.width, clean.height
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise TradeError('This photo could not be read. Choose a JPG, JPEG, PNG, WebP, HEIC, or HEIF photo of at least 32 pixels and up to 200 megapixels.', 'INVALID_IMAGE', 422) from None
