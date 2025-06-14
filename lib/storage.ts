import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

// Function to upload an image to Supabase storage
export async function uploadImage(file: File, roomId: string): Promise<string | null> {
  try {
    // Get file extension
    const fileExt = file.name.split('.').pop();
    // Create unique filename
    const fileName = `${uuidv4()}.${fileExt}`;
    // Create path based on room
    const filePath = `room-${roomId}/${fileName}`;
    
    console.log('Uploading file to path:', filePath);
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('chat-images')
      .upload(filePath, file);
    
    if (error) {
      console.error('Error uploading image:', error);
      return null;
    }
    
    console.log('File uploaded successfully, data:', data);
    
    // Get the public URL
    const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(filePath);
    
    // Log the URL to help with debugging
    console.log('Generated public URL:', urlData.publicUrl);
    
    if (!urlData || !urlData.publicUrl) {
      console.error('Failed to generate public URL');
      return null;
    }
    
    return urlData.publicUrl;
  } catch (err) {
    console.error('Exception uploading image:', err);
    return null;
  }
}

// Function to validate file type and size
export function validateFile(file: File): { valid: boolean; message?: string } {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB max size
  
  if (!validTypes.includes(file.type)) {
    return { 
      valid: false, 
      message: 'Invalid file type. Please select an image (JPEG, PNG, GIF, or WEBP)' 
    };
  }
  
  if (file.size > maxSize) {
    return { 
      valid: false, 
      message: 'File is too large. Maximum size is 5MB' 
    };
  }
  
  return { valid: true };
} 