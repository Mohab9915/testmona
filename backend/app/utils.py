"""
Utility functions for sanitization and validation.

Note on XSS: user-supplied text is stored verbatim and escaped at *render*
time, not on write. React escapes text nodes by default, and every
``dangerouslySetInnerHTML`` path runs its value through DOMPurify (see
``frontend/src/lib/sanitize.ts``). Escaping on write instead corrupted
ordinary prose -- ``Noise & Turn`` was stored as ``Noise &amp; Turn`` and
``customer's`` as ``customer&#x27;s`` -- and re-saving compounded it.
"""

import re
import json
from urllib.parse import urlparse
from typing import Any
from fastapi import HTTPException

# C0/C1 control characters have no place in stored text; tab, newline and
# carriage return are kept because multi-line fields rely on them.
_CONTROL_CHARS_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]')


def is_valid_url(url: str) -> bool:
    """Validate that a URL is properly formatted and safe"""
    try:
        result = urlparse(url)
        # Ensure scheme is http or https
        if result.scheme not in ['http', 'https']:
            return False
        # Ensure netloc (domain) exists
        if not result.netloc:
            return False
        # Prevent javascript: and other dangerous protocols
        if re.match(r'^[a-zA-Z]*:', url) and not url.startswith(('http://', 'https://')):
            return False
        return True
    except Exception:
        return False


def normalize_user_text(value: Any) -> Any:
    """Normalize a user-supplied string for storage, preserving it verbatim.

    Strips control characters only. HTML is deliberately *not* escaped here --
    see the module docstring for why that happens on render instead.
    """
    if not isinstance(value, str):
        return value
    return _CONTROL_CHARS_RE.sub('', value)


def sanitize_string(value: str) -> str:
    """Normalize a string for storage (whitespace-trimmed, control chars removed)."""
    if not isinstance(value, str):
        return value
    return normalize_user_text(value.strip())


def sanitize_data(data: Any, skip_fields: set = None) -> Any:
    """
    Recursively sanitize data to prevent XSS attacks.
    Handles nested dictionaries, lists, and JSON strings.
    
    Args:
        data: The data to sanitize (can be dict, list, str, or other types)
        skip_fields: Set of field names to skip sanitization for
    
    Returns:
        Sanitized data with the same structure
    """
    if skip_fields is None:
        skip_fields = set()
    
    if isinstance(data, dict):
        sanitized = {}
        for key, value in data.items():
            if key in skip_fields:
                # Skip sanitization for specified fields but validate them
                if key == 'website' and isinstance(value, str):
                    # Validate URL format
                    if value and not is_valid_url(value):
                        raise HTTPException(status_code=400, detail=f"Invalid URL format for field: {key}")
                sanitized[key] = value
            else:
                sanitized[key] = sanitize_data(value, skip_fields)
        return sanitized
    
    elif isinstance(data, list):
        return [sanitize_data(item, skip_fields) for item in data]
    
    elif isinstance(data, str):
        # Check if it's a JSON string that needs parsing and sanitizing
        try:
            # Try to parse as JSON
            parsed = json.loads(data)
            # If successful, sanitize the parsed data and convert back to string
            sanitized = sanitize_data(parsed, skip_fields)
            return json.dumps(sanitized)
        except (json.JSONDecodeError, TypeError):
            # Not a JSON string, sanitize as regular string
            return sanitize_string(data)
    
    else:
        # Return other types as-is
        return data
