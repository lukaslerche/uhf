// TagFormat.ts
// Model for RFID tag formats and utility functions

export type Block = {
  name: string;
  sizeBits: number;
  editable: boolean;
  value: Uint8Array;
  description?: string;
};

export type TagFormat = {
  name: string;
  blocks: Block[];
  tid: Uint8Array;
  passwordBytes?: number; // Number of bytes to use for password calculation
};

export type Passwords = {
  kill: string;
  access: string;
  killKey?: string;
  accessKey?: string;
};

// Generate a random TID with fixed prefix E2 80 68 94 20
export function generateRandomTID(): Uint8Array {
  const fixedPrefix = new Uint8Array([0xE2, 0x80, 0x68, 0x94, 0x20]);
  const randomBytes = new Uint8Array(7);
  
  // Generate 7 random bytes
  crypto.getRandomValues(randomBytes);
  
  // Combine fixed prefix with random bytes
  const tid = new Uint8Array(12);
  tid.set(fixedPrefix, 0);
  tid.set(randomBytes, 5);
  
  return tid;
}

// Calculate SHA-512 hash of EPC data with secret key and return first 4 bytes
async function calculatePassword(epcData: Uint8Array, secretKey: string, bytesToUse: number = 12): Promise<Uint8Array> {
  // Get specified number of bytes from EPC (default 12 bytes/96 bits)
  const epcBytes = epcData.slice(0, bytesToUse);
  
  // Create encoder for UTF-8 string conversion
  const encoder = new TextEncoder();
  const secretKeyBytes = encoder.encode(secretKey);
  
  // Create SHA-512 hash of EPC data
  const hash = await crypto.subtle.digest(
    'SHA-512',
    new Uint8Array([...epcBytes, ...secretKeyBytes])
  );

  // Return first 4 bytes (32 bits) of hash
  return new Uint8Array(hash.slice(0, 4));
}

// Extract kill password and access password from SHA-512 hashes
export async function calculatePasswords(epcData: Uint8Array, killKey?: string, accessKey?: string, bytesToUse: number = 12): Promise<Passwords> {
  // Default passwords if keys not provided
  let killPassword = '00000000';
  let accessPassword = '00000000';

  if (killKey) {
    const killBytes = await calculatePassword(epcData, killKey, bytesToUse);
    killPassword = Array.from(killBytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  if (accessKey) {
    const accessBytes = await calculatePassword(epcData, accessKey, bytesToUse);
    accessPassword = Array.from(accessBytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  return {
    kill: killPassword,
    access: accessPassword,
    killKey,
    accessKey
  };
}

// Calculate RES by combining kill password and access password
export async function calculateRES(epcData: Uint8Array, bytesToUse: number = 12): Promise<Uint8Array> {
  const passwords = await calculatePasswords(epcData, undefined, undefined, bytesToUse);
  
  // Convert both passwords from hex strings to bytes
  const killBytes = new Uint8Array(4);
  const accessBytes = new Uint8Array(4);
  
  // Parse kill password
  for (let i = 0; i < 8; i += 2) {
    killBytes[i/2] = parseInt(passwords.kill.slice(i, i + 2), 16);
  }
  
  // Parse access password
  for (let i = 0; i < 8; i += 2) {
    accessBytes[i/2] = parseInt(passwords.access.slice(i, i + 2), 16);
  }
  
  // Combine into final 8-byte RES
  const res = new Uint8Array(8);
  res.set(killBytes, 0);
  res.set(accessBytes, 4);
  
  return res;
}

// Example tag format (128 bit EPC)
export const exampleTagFormat: TagFormat = {
  name: 'UB Dortmund 128-bit EPC',
  blocks: [
    {
      name: 'EPC-CRC',
      sizeBits: 16,
      editable: false,
      value: new Uint8Array([0xF8, 0xD4]),
      description: 'CRC (fixed)',
    },
    {
      name: 'EPC-PC',
      sizeBits: 16,
      editable: false,
      value: new Uint8Array([0x40, 0x00]),
      description: 'RFID Meta Info (fixed)',
    },
    {
      name: 'EPC-DATA',
      sizeBits: 128,
      editable: true,
      value: new Uint8Array([0x19,0xE9,0xF8,0x71,0x00,0x00,0x00,0x00,0x07,0x5B,0xCD,0x15,0x00,0x00,0x00,0x01]),
      description: 'Library/Media Data',
    },
    {
      name: 'RES',
      sizeBits: 64,
      editable: false,
      value: new Uint8Array([0x28,0x2F,0xFD,0xFB,0xE2,0xE2,0x21,0xDE]),
      description: 'RES (auto-calculated)',
    },
  ],
  tid: generateRandomTID(),
  passwordBytes: 12, // Use first 12 bytes for password calculation
};

// BookWaves tag format (128 bit EPC)
export const bookWavesTagFormat: TagFormat = {
  name: 'Generic BookWaves 128-bit EPC',
  blocks: [
    {
      name: 'EPC-CRC',
      sizeBits: 16,
      editable: false,
      value: new Uint8Array([0xF8, 0xD4]),
      description: 'CRC (fixed)',
    },
    {
      name: 'EPC-PC',
      sizeBits: 16,
      editable: false,
      value: new Uint8Array([0x40, 0x00]),
      description: 'RFID Meta Info (fixed)',
    },
    {
      name: 'EPC-DATA',
      sizeBits: 128,
      editable: true,
      value: new Uint8Array([0x19,0xE9,0xF8,0x71,0x20,0x21,0x22,0x23,0x24,0x25,0x26,0x27,0x28,0x29,0x00,0x01]),
      description: 'Library/Media Data',
    },
    {
      name: 'RES',
      sizeBits: 64,
      editable: false,
      value: new Uint8Array([0x28,0x2F,0xFD,0xFB,0xE2,0xE2,0x21,0xDE]),
      description: 'RES (auto-calculated)',
    },
  ],
  tid: generateRandomTID(),
  passwordBytes: 14, // Use first 14 bytes for password calculation
};
