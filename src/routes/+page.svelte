<script lang="ts">
import { exampleTagFormat, calculateRES, calculatePasswords, generateRandomTID, type TagFormat, bookWavesTagFormat } from '$lib/TagFormat';
import { decode } from '$lib/urncode40';
import '@picocss/pico';

// Generate random CRC bytes (2 bytes)
function generateRandomCRC(): Uint8Array {
  const crc = new Uint8Array(2);
  crypto.getRandomValues(crc);
  
  // Ensure CRC bytes are never zero (if they are, set to a random value between 1-255)
  if (crc[0] === 0 && crc[1] === 0) {
    crc[0] = Math.floor(Math.random() * 255) + 1;
    crc[1] = Math.floor(Math.random() * 255) + 1;
  } else if (crc[0] === 0) {
    crc[0] = Math.floor(Math.random() * 255) + 1;
  } else if (crc[1] === 0) {
    crc[1] = Math.floor(Math.random() * 255) + 1;
  }
  
  return crc;
}

// State variables with Svelte 5 reactivity
let tagFormats = $state([exampleTagFormat, bookWavesTagFormat]);
let selectedFormat = $state(exampleTagFormat);
// Use $state directly for values that need direct manipulation
let epcData = $state(new Uint8Array(exampleTagFormat.blocks.find(b => b.name === 'EPC-DATA')?.value ?? []));
let epcPC = $state(new Uint8Array(exampleTagFormat.blocks.find(b => b.name === 'EPC-PC')?.value ?? []));
let tid = $state(generateRandomTID());
let crcBytes = $state(generateRandomCRC());
let invalidInputs = $state(new Set<number>());
let killKey = $state('');
let accessKey = $state('');

// Derived values that automatically update when epcData changes
let res = $derived.by(async () => calculateRES(epcData, selectedFormat.passwordBytes));
let passwords = $derived.by(async () => {
  return await calculatePasswords(epcData, killKey, accessKey, selectedFormat.passwordBytes);
});

let killPassword = $derived.by(async () => (await passwords).kill);
let accessPassword = $derived.by(async () => (await passwords).access);

// Get section sizes based on selected format
let librarySigleSize = $derived(selectedFormat.name === 'UB Dortmund 128-bit EPC' ? 4 : 4);
let mediaNumberSize = $derived(selectedFormat.name === 'UB Dortmund 128-bit EPC' ? 8 : 10);
let bitflagsSize = $derived(selectedFormat.name === 'UB Dortmund 128-bit EPC' ? 4 : 2);

// Derived decoded values for each section of the tag
let decodedLibrarySignle = $derived(decodeLibrarySignle([...epcData].slice(0, librarySigleSize)));
let decodedMediaNumber = $derived(
  selectedFormat.name === 'UB Dortmund 128-bit EPC' 
  ? decodeMediaNumber([...epcData].slice(librarySigleSize, librarySigleSize + mediaNumberSize))
  : decodeURNCode40MediaNumber([...epcData].slice(librarySigleSize, librarySigleSize + mediaNumberSize))
);
let securityStatus = $derived(decodeSecurityStatus([...epcData].slice(librarySigleSize + mediaNumberSize)));

// Decode the library sigle using URN Code 40 decoding
function decodeLibrarySignle(bytes: number[]): string {
  const hexString = bytes.map(byteToHex).join('');
  const decoded = decode(hexString);
  return decoded || 'Invalid URN Code 40';
}

// Decode the media number (simple hex to number)
function decodeMediaNumber(bytes: number[]): string {
  // Create a hex string from the byte array
  const hexString = bytes.map(byteToHex).join('');
  // Parse as big integer to handle potentially large numbers
  try {
    const numericValue = BigInt(`0x${hexString}`).toString();
    return numericValue;
  } catch (e) {
    return 'Invalid hex value';
  }
}

// Decode the media number using URN Code 40 (for BookWaves format)
function decodeURNCode40MediaNumber(bytes: number[]): string {
  const hexString = bytes.map(byteToHex).join('');
  const decoded = decode(hexString);
  return decoded || 'Invalid URN Code 40';
}

// Decode the security status from the bitflags
function decodeSecurityStatus(bytes: number[]): string {
  // Check if the very last bit (LSB of the last byte) is 1
  const lastByte = bytes[bytes.length - 1] || 0;
  const isSecured = (lastByte & 0x01) === 1;
  return isSecured ? 'secured (in library)' : 'unsecured (lent out)';
}

// Update the selected format
function selectFormat(idx: number) {
  selectedFormat = tagFormats[idx];
  epcData = new Uint8Array(selectedFormat.blocks.find(b => b.name === 'EPC-DATA')?.value ?? []);
  epcPC = new Uint8Array(selectedFormat.blocks.find(b => b.name === 'EPC-PC')?.value ?? []);
  tid = generateRandomTID(); // Generate a new random TID when format changes
  crcBytes = generateRandomCRC(); // Generate new random CRC bytes
  invalidInputs.clear(); // Clear any invalid input markers
}

// Helper to convert byte to hex string representation
function byteToHex(byte: number): string {
  return byte.toString(16).padStart(2, '0').toUpperCase();
}

// Validate hex input - only allow valid hex characters (0-9, A-F)
function isValidHex(value: string): boolean {
  return /^[0-9A-Fa-f]{1,2}$/.test(value);
}

// Handle input for byte values with validation
function updateEpcData(index: number, value: string) {
  if (!isValidHex(value)) {
    invalidInputs.add(index);
    return;
  }
  
  const num = parseInt(value, 16);
  if (!isNaN(num) && num >= 0 && num <= 255) {
    const newEpcData = new Uint8Array(epcData);
    newEpcData[index] = num;
    epcData = newEpcData;
    invalidInputs.delete(index); // Clear invalid status once fixed
  } else {
    invalidInputs.add(index);
  }
}


</script>

<main class="container">
   <div class="grid">
    <label>
      Tag Format:
      <select onchange={(e) => selectFormat(e.currentTarget.selectedIndex)}>
        {#each tagFormats as format, i}
          <option value={i}>{format.name}</option>
        {/each}
      </select>
    </label>
    
    <label>
      Kill Key:
      <input 
        type="text" 
        placeholder="Enter kill key" 
        value={killKey}
        oninput={(e) => killKey = e.currentTarget.value}
        style="width: 100%;"
      />
    </label>

    <label>
      Access Key:
      <input 
        type="text" 
        placeholder="Enter access key" 
        value={accessKey}
        oninput={(e) => accessKey = e.currentTarget.value}
        style="width: 100%;"
      />
    </label>
  </div>

  <article>
    <header>
      <h2>EPC Memory</h2>
    </header>
    <table role="grid">
      <thead>
        <tr><th>Block</th><th>Bytes (Hex)</th><th>Description</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>EPC-CRC</td>
          <td>
            <div class="byte-display">
              {#each [...crcBytes] as byte, i}
                <div class="byte-box">{byteToHex(byte)}</div>
              {/each}
            </div>
          </td>
          <td>CRC (calculated on-chip)</td>
        </tr>
        <tr>
          <td>EPC-PC</td>
          <td>
            <div class="byte-display">
              <div class="byte-box">40</div>
              <div class="byte-box">00</div>
            </div>
          </td>
          <td>RFID Meta Info (fixed)</td>
        </tr>
        <tr>
          <td>EPC-DATA</td>
          <td style="max-width: 600px;">
            <div class="section-container">
              <div class="section">
                <div class="section-label">Library Sigle (<a href="https://urncode40.vercel.app/" target="_blank">URN Code 40 enc</a>)</div>
                <div class="byte-display">
                  {#each [...epcData].slice(0, librarySigleSize) as byte, i}
                    <input 
                      type="text" 
                      size="2" 
                      maxlength="2" 
                      value={byteToHex(byte)} 
                      oninput={(e) => updateEpcData(i, e.currentTarget.value)}
                      class={invalidInputs.has(i) ? 'invalid' : ''}
                      pattern="[0-9A-Fa-f]{2}"
                    />
                  {/each}
                </div>
                <div class="decoded-value">Decoded: {decodedLibrarySignle}</div>
              </div>
              
              <div class="section">
                <div class="section-label">
                  Media Number {selectedFormat.name === 'Generic BookWaves 128-bit EPC' ? '(URN Code 40 enc)' : ''}
                </div>
                <div class="byte-display">
                  {#each [...epcData].slice(librarySigleSize, librarySigleSize + mediaNumberSize) as byte, i}
                    <input 
                      type="text" 
                      size="2" 
                      maxlength="2" 
                      value={byteToHex(byte)} 
                      oninput={(e) => updateEpcData(i + librarySigleSize, e.currentTarget.value)}
                      class={invalidInputs.has(i + librarySigleSize) ? 'invalid' : ''}
                      pattern="[0-9A-Fa-f]{2}"
                    />
                    {#if (i+1)%4===0} <span style="margin-right: 0.25em;"></span> {/if}
                  {/each}
                </div>
                <div class="decoded-value">Decoded: {decodedMediaNumber}</div>
              </div>
              
              <div class="section">
                <div class="section-label">Bitflags (e.g. security bit)</div>
                <div class="byte-display">
                  {#each [...epcData].slice(librarySigleSize + mediaNumberSize, librarySigleSize + mediaNumberSize + bitflagsSize) as byte, i}
                    <input 
                      type="text" 
                      size="2" 
                      maxlength="2" 
                      value={byteToHex(byte)} 
                      oninput={(e) => updateEpcData(i + librarySigleSize + mediaNumberSize, e.currentTarget.value)}
                      class={invalidInputs.has(i + librarySigleSize + mediaNumberSize) ? 'invalid' : ''}
                      pattern="[0-9A-Fa-f]{2}"
                    />
                  {/each}
                </div>
                <div class="decoded-value">Status: {securityStatus}</div>
              </div>
            </div>
          </td>
          <td>Library/Media Data (editable)</td>
        </tr>
        <tr>
          <td>RES</td>
          <td>
            <div class="passwords-info">
              {#await killPassword}
                <div>Kill Password: loading...</div>
              {:then value}
                <div>Kill Password: <span class="password-value">{value}</span></div>
              {/await}
              {#await accessPassword}
                <div>Access Password: loading...</div>
              {:then value}
                <div>Access Password: <span class="password-value">{value}</span></div>
              {/await}
              <div class="format-info">
                Using {selectedFormat.passwordBytes} bytes for password calculation
                <details>
                  <summary>How passwords are calculated</summary>
                  <div class="calculation-details">
                    <ol>
                      <li>Take the first {selectedFormat.passwordBytes} bytes from the EPC-DATA field</li>
                      <li>Combine these bytes with the provided secret key (kill key or access key)</li>
                      <li>Calculate a SHA-512 hash of this combined value</li>
                      <li>Take the first 4 bytes (32 bits) of the resulting hash</li>
                      <li>This becomes the password (represented as an 8-character hex string)</li>
                    </ol>
                    <p><small>Security note: Passwords are derived on-demand and rely on the secrecy of your keys</small></p>
                  </div>
                </details>
              </div>
            </div>
          </td>
          <td>RES (calculated)</td>
        </tr>
        <tr>
          <td>TID</td>
          <td>
            <div class="byte-display">
              {#each [...tid] as byte}
                <div class="byte-box">{byteToHex(byte)}</div>
              {/each}
            </div>
           
          </td>
          <td>Tag ID (unique, unchangable)</td>
        </tr>
      </tbody>
    </table>
  </article>


</main>

<style>
  /* Custom styles to augment Pico CSS */
  input[type="text"] {
    font-family: monospace;
    text-align: center;
    padding: 0.25em;
    width: 2.5em;
    margin-right: 0.25em;
    border: 1px solid var(--form-element-border-color, #ccc);
    border-radius: 4px;
  }
  
  input.invalid {
    background-color: #ffdddd;
    border: 1px solid #f44336;
    box-shadow: 0 0 3px #f44336;
  }

  .byte-display {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25em;
  }

  .byte-box {
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: monospace;
    width: 2.5em;
    height: 2em;
    border: 1px solid var(--form-element-border-color, #ccc);
    border-radius: 4px;
  }
  
  .section-container {
    display: flex;
    flex-direction: column;
    gap: 1em;
  }
  
  .section {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
    padding: 0.5em;
    border: 1px solid var(--card-border-color, #ddd);
    border-radius: 4px;
    background-color: var(--card-sectionning-background-color, rgba(0,0,0,0.02));
  }
  
  .section-label {
    font-size: 0.75em;
    font-weight: bold;
    margin-bottom: 0.25em;
  }

  .decoded-value {
    font-size: 0.75em;
    margin-top: 0.25em;
  }
  
  .passwords-info {
    font-size: 0.85em;
    margin-top: 1em;
    padding: 0.5em;
    border: 1px solid var(--card-border-color, #ddd);
    border-radius: 4px;
    background-color: var(--card-sectionning-background-color, rgba(0,0,0,0.02));
  }
  
  .password-value {
    font-family: monospace;
    font-weight: bold;
  }

  .format-info {
    font-size: 0.7em;
    color: #666;
    margin-top: 0.5em;
  }

  .calculation-details {
    font-size: 0.75em;
    margin-top: 0.5em;
  }
</style>
