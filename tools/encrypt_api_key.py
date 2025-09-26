import os
from cryptography.fernet import Fernet

# Generate a key and save it (run once)
def generate_key(file_path="secret.key"):
    key = Fernet.generate_key()
    with open(file_path, "wb") as key_file:
        key_file.write(key)
    print(f"Key saved to {file_path}")

# Load the key
def load_key(file_path="secret.key"):
    return open(file_path, "rb").read()

# Encrypt API key
def encrypt_api_key(api_key: str, key_path="secret.key", out_path="api.enc"):
    key = load_key(key_path)
    f = Fernet(key)
    encrypted = f.encrypt(api_key.encode())
    with open(out_path, "wb") as enc_file:
        enc_file.write(encrypted)
    print(f"Encrypted API key saved to {out_path}")

# Decrypt API key
def decrypt_api_key(enc_path="api.enc", key_path="secret.key"):
    key = load_key(key_path)
    f = Fernet(key)
    with open(enc_path, "rb") as enc_file:
        encrypted = enc_file.read()
    decrypted = f.decrypt(encrypted)
    return decrypted.decode()

if __name__ == "__main__":
    # Example usage:
    # Step 1: Run once to generate key
    # generate_key()
    #
    # Step 2: Encrypt your API key
    # encrypt_api_key("your-htx-api-key")
    #
    # Step 3: Decrypt it when needed
    # print(decrypt_api_key())
    pass
