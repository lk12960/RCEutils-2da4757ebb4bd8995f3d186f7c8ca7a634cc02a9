const db = require('../database/db');

// Utility to generate a simple unique ID for notes
function generateNoteId() {
  return Math.random().toString(36).substr(2, 9);
}

// Add a new note
async function addNote(userId, moderatorId, noteContent) {
  const noteId = generateNoteId();
  const timestamp = new Date().toISOString();
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO notes (id, userId, moderatorId, content, timestamp) VALUES (?, ?, ?, ?, ?)',
      [noteId, userId, moderatorId, noteContent, timestamp],
      function (err) {
        if (err) {
          console.error('Failed to add note:', err);
          reject(err);
        } else {
          resolve(noteId);
        }
      }
    );
  });
}

// Get all notes for a user
async function getUserNotes(userId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM notes WHERE userId = ?', [userId], (err, rows) => {
      if (err) {
        console.error('Failed to fetch notes:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Remove a note by ID
async function removeNote(noteId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM notes WHERE id = ?', [noteId], (err, row) => {
      if (err) {
        console.error('Failed to fetch note for removal:', err);
        reject(err);
      } else if (!row) {
        resolve(null);
      } else {
        db.run('DELETE FROM notes WHERE id = ?', [noteId], function (err) {
          if (err) {
            console.error('Failed to remove note:', err);
            reject(err);
          } else {
            resolve(row);
          }
        });
      }
    });
  });
}

module.exports = { addNote, getUserNotes, removeNote };