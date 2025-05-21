import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check if this is an authorized request (you might want to add more security)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if the chat-images bucket exists
    const { data: buckets, error: bucketError } = await supabase
      .storage
      .listBuckets();

    if (bucketError) {
      return res.status(500).json({ 
        error: 'Failed to list storage buckets',
        details: bucketError 
      });
    }

    const chatImagesBucket = buckets.find(b => b.name === 'chat-images');
    
    if (!chatImagesBucket) {
      return res.status(404).json({ 
        error: 'The chat-images bucket does not exist',
        buckets: buckets.map(b => b.name)
      });
    }

    // List files in the chat-images bucket
    const { data: files, error: filesError } = await supabase
      .storage
      .from('chat-images')
      .list();

    if (filesError) {
      return res.status(500).json({ 
        error: 'Failed to list files in chat-images bucket',
        details: filesError 
      });
    }

    // Return debug information
    return res.status(200).json({
      success: true,
      storage: {
        bucketExists: !!chatImagesBucket,
        bucketInfo: chatImagesBucket,
        files: files || [],
        publicUrl: files && files.length > 0 
          ? supabase.storage.from('chat-images').getPublicUrl(files[0].name).data.publicUrl
          : null
      },
      env: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      }
    });
  } catch (error) {
    console.error('Error in storage debug route:', error);
    return res.status(500).json({ error: 'Server error', details: error });
  }
} 