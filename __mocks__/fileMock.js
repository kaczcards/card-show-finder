// __mocks__/fileMock.js
//
// This file provides a mock for static assets (images, fonts, videos, etc.)
// that are imported in components but can't be directly used in Jest tests.
// 
// When a test imports an asset like:
//   import logo from '../assets/logo.png';
// Jest will use this mock instead of the actual file.

module.exports = 'test-file-stub';
