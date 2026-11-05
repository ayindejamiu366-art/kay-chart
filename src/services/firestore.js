// DEPRECATED: This file is no longer imported. Safe to remove after verification.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';

// User operations
export const userService = {
  async getUser(uid) {
    const userDoc = await getDoc(doc(db, 'users', uid));
    return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
  },

  async updateUser(uid, data) {
    await updateDoc(doc(db, 'users', uid), {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  async getAllUsers() {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async searchUsers(query) {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('displayName', '>=', query),
      where('displayName', '<=', query + '\uf8ff'),
      limit(20)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
};

// Playlist operations
export const playlistService = {
  async getUserPlaylists(userId) {
    const playlistsRef = collection(db, 'playlists');
    const q = query(playlistsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async createPlaylist(userId, name, description = '') {
    const playlistsRef = collection(db, 'playlists');
    const newPlaylist = {
      userId,
      name,
      description,
      songs: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const docRef = await addDoc(playlistsRef, newPlaylist);
    return { id: docRef.id, ...newPlaylist };
  },

  async updatePlaylist(playlistId, data) {
    await updateDoc(doc(db, 'playlists', playlistId), {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  async deletePlaylist(playlistId) {
    await deleteDoc(doc(db, 'playlists', playlistId));
  },

  async addSongsToPlaylist(playlistId, songIds) {
    const playlistRef = doc(db, 'playlists', playlistId);
    await updateDoc(playlistRef, {
      songs: arrayUnion(...songIds),
      updatedAt: serverTimestamp()
    });
  },

  async removeSongsFromPlaylist(playlistId, songIds) {
    const playlistRef = doc(db, 'playlists', playlistId);
    await updateDoc(playlistRef, {
      songs: arrayRemove(...songIds),
      updatedAt: serverTimestamp()
    });
  }
};

// Library operations
export const libraryService = {
  async getLikedSongs(userId) {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    return userDoc.exists() ? userDoc.data().likedSongs || [] : [];
  },

  async toggleLikeSong(userId, songId) {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const likedSongs = userDoc.data()?.likedSongs || [];
    
    if (likedSongs.includes(songId)) {
      await updateDoc(userRef, { likedSongs: arrayRemove(songId) });
      return false;
    } else {
      await updateDoc(userRef, { likedSongs: arrayUnion(songId) });
      return true;
    }
  },

  async getDownloads(userId) {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    return userDoc.exists() ? userDoc.data().downloads || [] : [];
  },

  async toggleDownload(userId, songId) {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const downloads = userDoc.data()?.downloads || [];
    
    if (downloads.includes(songId)) {
      await updateDoc(userRef, { downloads: arrayRemove(songId) });
      return false;
    } else {
      await updateDoc(userRef, { downloads: arrayUnion(songId) });
      return true;
    }
  },

  async addToHistory(userId, songId) {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const history = userDoc.data()?.playHistory || [];
    
    const newHistory = [songId, ...history.filter(id => id !== songId)].slice(0, 100);
    await updateDoc(userRef, { playHistory: newHistory });
  },

  async getHistory(userId) {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    return userDoc.exists() ? userDoc.data().playHistory || [] : [];
  }
};

// Song operations
export const songService = {
  async getSongs(genre = null, limitCount = 50) {
    const songsRef = collection(db, 'songs');
    let q;
    
    if (genre) {
      q = query(songsRef, where('genre', '==', genre), limit(limitCount));
    } else {
      q = query(songsRef, limit(limitCount));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getSong(songId) {
    const songDoc = await getDoc(doc(db, 'songs', songId));
    return songDoc.exists() ? { id: songDoc.id, ...songDoc.data() } : null;
  },

  async uploadSong(songData, audioFile, coverFile) {
    const songsRef = collection(db, 'songs');
    
    let audioUrl = '';
    let coverUrl = '';
    
    if (audioFile) {
      const audioRef = ref(storage, `songs/audio/${Date.now()}_${audioFile.name}`);
      await uploadBytes(audioRef, audioFile);
      audioUrl = await getDownloadURL(audioRef);
    }
    
    if (coverFile) {
      const coverRef = ref(storage, `songs/covers/${Date.now()}_${coverFile.name}`);
      await uploadBytes(coverRef, coverFile);
      coverUrl = await getDownloadURL(coverRef);
    }
    
    const newSong = {
      ...songData,
      audioUrl,
      coverUrl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(songsRef, newSong);
    return { id: docRef.id, ...newSong };
  },

  async updateSong(songId, data) {
    await updateDoc(doc(db, 'songs', songId), {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  async deleteSong(songId) {
    await deleteDoc(doc(db, 'songs', songId));
  }
};

// Storage operations
export const storageService = {
  async uploadFile(path, file) {
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  },

  async deleteFile(path) {
    const fileRef = ref(storage, path);
    await deleteObject(fileRef);
  }
};