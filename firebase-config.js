/**
 * firebase-config.js — BIZ Level Up Dashboard (PR)
 * Uses Firebase compat SDK (loaded via CDN in index.html).
 * Sets window.db for use by firebase-bridge.js and all other files.
 */
const firebaseConfig = {
  apiKey:            "AIzaSyAXagI_dHF2cP7F64jC2EdyxytjepcgXxA",
  authDomain:        "pr-dashboard-d4b14.firebaseapp.com",
  databaseURL:       "https://pr-dashboard-d4b14-default-rtdb.firebaseio.com",
  projectId:         "pr-dashboard-d4b14",
  storageBucket:     "pr-dashboard-d4b14.firebasestorage.app",
  messagingSenderId: "996098057132",
  appId:             "1:996098057132:web:5a643b7f0daf36eea25009"
};

firebase.initializeApp(firebaseConfig);
window.db = firebase.database();
