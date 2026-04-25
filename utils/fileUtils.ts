/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Converts a File object to a Base64 encoded string with a data URI prefix.
 * @param file The file to convert.
 * @returns A promise that resolves with the Base64 data URI string.
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};
