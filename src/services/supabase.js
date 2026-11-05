import { supabase } from '../supabase';

// User operations
export const supabaseUserService = {
  async getUser(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateUser(userId, updates) {
    const { data, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getAllUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('*');
    
    if (error) throw error;
    return data;
  },

  async searchUsers(searchQuery) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('display_name', `%${searchQuery}%`)
      .limit(20);
    
    if (error) throw error;
    return data;
  }
};

// Playlist operations
export const supabasePlaylistService = {
  async getUserPlaylists(userId) {
    const { data, error } = await supabase
      .from('playlists')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async createPlaylist(userId, name, description = '') {
    const { data, error } = await supabase
      .from('playlists')
      .insert({
        user_id: userId,
        name,
        description,
        songs: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updatePlaylist(playlistId, updates) {
    const { data, error } = await supabase
      .from('playlists')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', playlistId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deletePlaylist(playlistId) {
    const { error } = await supabase
      .from('playlists')
      .delete()
      .eq('id', playlistId);
    
    if (error) throw error;
  },

  async addSongsToPlaylist(playlistId, songIds) {
    const { data: playlist, error: fetchError } = await supabase
      .from('playlists')
      .select('songs')
      .eq('id', playlistId)
      .single();
    
    if (fetchError) throw fetchError;
    
    const updatedSongs = [...new Set([...playlist.songs, ...songIds])];
    
    const { data, error } = await supabase
      .from('playlists')
      .update({ songs: updatedSongs, updated_at: new Date().toISOString() })
      .eq('id', playlistId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async removeSongsFromPlaylist(playlistId, songIds) {
    const { data: playlist, error: fetchError } = await supabase
      .from('playlists')
      .select('songs')
      .eq('id', playlistId)
      .single();
    
    if (fetchError) throw fetchError;
    
    const updatedSongs = playlist.songs.filter(id => !songIds.includes(id));
    
    const { data, error } = await supabase
      .from('playlists')
      .update({ songs: updatedSongs, updated_at: new Date().toISOString() })
      .eq('id', playlistId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// Library operations
export const supabaseLibraryService = {
  async getLikedSongs(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('liked_songs')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data?.liked_songs || [];
  },

  async toggleLikeSong(userId, songId) {
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('liked_songs')
      .eq('id', userId)
      .single();
    
    if (fetchError) throw fetchError;
    
    const likedSongs = user.liked_songs || [];
    const isLiked = likedSongs.includes(songId);
    
    const updatedSongs = isLiked
      ? likedSongs.filter(id => id !== songId)
      : [...likedSongs, songId];
    
    const { error } = await supabase
      .from('users')
      .update({ liked_songs: updatedSongs })
      .eq('id', userId);
    
    if (error) throw error;
    return !isLiked;
  },

  async getDownloads(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('downloads')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data?.downloads || [];
  },

  async toggleDownload(userId, songId) {
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('downloads')
      .eq('id', userId)
      .single();
    
    if (fetchError) throw fetchError;
    
    const downloads = user.downloads || [];
    const isDownloaded = downloads.includes(songId);
    
    const updatedDownloads = isDownloaded
      ? downloads.filter(id => id !== songId)
      : [...downloads, songId];
    
    const { error } = await supabase
      .from('users')
      .update({ downloads: updatedDownloads })
      .eq('id', userId);
    
    if (error) throw error;
    return !isDownloaded;
  },

  async addToHistory(userId, songId) {
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('play_history')
      .eq('id', userId)
      .single();
    
    if (fetchError) throw fetchError;
    
    const history = user.play_history || [];
    const newHistory = [songId, ...history.filter(id => id !== songId)].slice(0, 100);
    
    const { error } = await supabase
      .from('users')
      .update({ play_history: newHistory })
      .eq('id', userId);
    
    if (error) throw error;
  },

  async getHistory(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('play_history')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data?.play_history || [];
  }
};

// Song operations
export const supabaseSongService = {
  async getSongs(genre = null, limitCount = 50) {
    let query = supabase
      .from('songs')
      .select('*')
      .limit(limitCount);
    
    if (genre) {
      query = query.eq('genre', genre);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  },

  async getSong(songId) {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('id', songId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async uploadSong(songData, audioFile, coverFile) {
    let audioUrl = '';
    let coverUrl = '';
    
    if (audioFile) {
      const audioFileName = `songs/audio/${Date.now()}_${audioFile.name}`;
      const { error: audioError } = await supabase.storage
        .from('media')
        .upload(audioFileName, audioFile);
      
      if (audioError) throw audioError;
      
      const { data: audioData } = supabase.storage
        .from('media')
        .getPublicUrl(audioFileName);
      
      audioUrl = audioData.publicUrl;
    }
    
    if (coverFile) {
      const coverFileName = `songs/covers/${Date.now()}_${coverFile.name}`;
      const { error: coverError } = await supabase.storage
        .from('media')
        .upload(coverFileName, coverFile);
      
      if (coverError) throw coverError;
      
      const { data: coverData } = supabase.storage
        .from('media')
        .getPublicUrl(coverFileName);
      
      coverUrl = coverData.publicUrl;
    }
    
    const { data, error } = await supabase
      .from('songs')
      .insert({
        ...songData,
        audio_url: audioUrl,
        cover_url: coverUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateSong(songId, updates) {
    const { data, error } = await supabase
      .from('songs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', songId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteSong(songId) {
    const { error } = await supabase
      .from('songs')
      .delete()
      .eq('id', songId);
    
    if (error) throw error;
  }
};

// Storage operations
export const supabaseStorageService = {
  async uploadFile(path, file) {
    const { error } = await supabase.storage
      .from('media')
      .upload(path, file);
    
    if (error) throw error;
    
    const { data } = supabase.storage
      .from('media')
      .getPublicUrl(path);
    
    return data.publicUrl;
  },

  async deleteFile(path) {
    const { error } = await supabase.storage
      .from('media')
      .remove([path]);
    
    if (error) throw error;
  }
};