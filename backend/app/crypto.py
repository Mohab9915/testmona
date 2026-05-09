"""
Cryptographic utilities for encrypting and decrypting sensitive data.
Uses Fernet symmetric encryption from the cryptography library.
"""
from cryptography.fernet import Fernet
import base64
import hashlib
from typing import Optional
from .config import settings


def get_encryption_key() -> bytes:
    """
    Generate or retrieve encryption key from the secret key.
    Uses SHA-256 hash of the secret key to ensure it's 32 bytes.
    """
    # Hash the secret key to get a 32-byte key suitable for Fernet
    key_hash = hashlib.sha256(settings.secret_key.encode()).digest()
    # Fernet requires a base64-encoded 32-byte key
    return base64.urlsafe_b64encode(key_hash)


def encrypt_data(plaintext: str) -> str:
    """
    Encrypt sensitive data using Fernet symmetric encryption.
    
    Args:
        plaintext: The plain text data to encrypt
        
    Returns:
        Base64-encoded encrypted string
    """
    if not plaintext:
        return plaintext
    
    key = get_encryption_key()
    fernet = Fernet(key)
    encrypted = fernet.encrypt(plaintext.encode())
    return encrypted.decode()


def decrypt_data(ciphertext: str) -> str:
    """
    Decrypt sensitive data using Fernet symmetric encryption.
    
    Args:
        ciphertext: The base64-encoded encrypted string
        
    Returns:
        Decrypted plain text string
        
    Raises:
        ValueError: If decryption fails
    """
    if not ciphertext:
        return ciphertext
    
    try:
        key = get_encryption_key()
        fernet = Fernet(key)
        decrypted = fernet.decrypt(ciphertext.encode())
        return decrypted.decode()
    except Exception as e:
        raise ValueError(f"Decryption failed: {str(e)}")


def is_encrypted(value: str) -> bool:
    """
    Check if a value appears to be encrypted (base64 encoded).
    This is a heuristic check and not foolproof.
    
    Args:
        value: The value to check
        
    Returns:
        True if the value appears to be encrypted, False otherwise
    """
    if not value:
        return False
    
    try:
        # Try to decode as base64
        decoded = base64.b64decode(value)
        # Check if it looks like Fernet encrypted data
        # Fernet encrypted data is at least 16 bytes (nonce) + ciphertext
        return len(decoded) >= 16
    except Exception:
        return False
