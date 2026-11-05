# Nocturne Music - Firebase Integration

This document describes the Firebase integration for the Nocturne Music app.

## Features Implemented

### 1. Firebase Authentication
- **Email/Password Authentication**: Users can sign up and sign in with email and password
- **Google Sign-In**: One-click sign-in with Google accounts
- **GitHub Sign-In**: Sign in with GitHub accounts
- **Facebook Sign-In**: Sign in with Facebook accounts
- **Password Reset**: Users can reset their password via email

### 2. Firestore Database
- **Users Collection**: Store user profiles and preferences
- **Songs Collection**: Store music tracks with metadata
- **Playlists Collection**: User-created playlists
- **Play History**: Track user listening history
- **Activity Feed**: Social activity tracking
- **Notifications**: User notifications

### 3. Firebase Storage
- **User Avatars**: Store user profile pictures
- **Song Audio Files**: Store music files
- **Song Cover Images**: Store album artwork
- **User Uploads**: Store user-uploaded content

## Configuration

### Environment Variables
Create a `.env` file in the root directory with the following:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Server-side Firebase
GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json
FIREBASE_PROJECT_ID=your_project_id
```

### Firebase Console Setup

1. **Enable Authentication Methods**:
   - Go to Firebase Console > Authentication > Sign-in method
   - Enable Email/Password
   - Enable Google
   - Enable GitHub
   - Enable Facebook

2. **Create Firestore Database**:
   - Go to Firebase Console > Firestore Database
   - Create database in production mode
   - Deploy security rules: `firebase deploy --only firestore:rules`

3. **Create Storage Bucket**:
   - Go to Firebase Console > Storage
   - Get started
   - Deploy security rules: `firebase deploy --only storage`

## Deployment

### Deploy Security Rules
```bash
firebase deploy --only firestore:rules,storage
```

### Deploy Firestore Indexes
```bash
firebase deploy --only firestore:indexes
```

### Deploy to Firebase Hosting
```bash
npm run build
firebase deploy --only hosting
```

## Migration from Custom Auth

The app has been migrated from a custom JWT-based authentication system to Firebase Authentication. Key changes:

1. **Frontend**:
   - Uses Firebase Auth SDK for authentication
   - Removed custom OTP verification flow
   - Added Firebase Auth context for state management

2. **Backend**:
   - Uses Firebase Admin SDK to verify tokens
   - Automatically creates users in local database on first login
   - Maintains backward compatibility with existing user data

3. **Database**:
   - Added `firebase_uid` column to users table
   - Links Firebase users to local database records

## Security Rules

### Firestore Rules
- Users can only read/write their own data
- Songs are publicly readable but only authenticated users can create
- Playlists are private by default
- Activity feed is readable by authenticated users

### Storage Rules
- User avatars are publicly readable
- Audio files are publicly readable
- Only authenticated users can upload

## Development

### Running Locally
```bash
npm install
npm run dev
```

### Testing Authentication
1. Start the development server
2. Navigate to the sign-up page
3. Create an account with email/password
4. Test Google sign-in (requires Google Cloud Console setup)

## Troubleshooting

### Common Issues

1. **"Firebase: No Firebase App"**:
   - Ensure Firebase is initialized before use
   - Check environment variables are set correctly

2. **"Permission denied"**:
   - Deploy security rules: `firebase deploy --only firestore:rules`
   - Check user authentication state

3. **"Invalid API key"**:
   - Verify API key in Firebase Console
   - Check `.env` file configuration

## Next Steps

1. Set up Firebase Cloud Functions for backend logic
2. Configure Firebase Cloud Messaging for push notifications
3. Set up Firebase Remote Config for feature flags
4. Implement Firebase Analytics for user tracking