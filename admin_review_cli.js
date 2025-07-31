#!/usr/bin/env node

/**
 * Card Show Finder - Admin Review CLI
 * 
 * A command-line interface for reviewing and providing feedback on scraped shows.
 * This tool connects to the admin-review Edge Function and allows admins to:
 * - List pending shows with quality scores
 * - Approve/reject/edit shows with structured feedback
 * - Perform batch operations
 * - View statistics and feedback patterns
 * - Find and resolve duplicates
 * - Export data for analysis
 */

const { program } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const axios = require('axios');
const ora = require('ora');
const { Table } = require('console-table-printer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const open = require('open');
const { createObjectCsvWriter } = require('csv-writer');
const fuzzy = require('fuzzy');
const dateFormat = require('dateformat');

// Load environment variables
dotenv.config();

// Constants
const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.card-show-finder');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
/**
 * Supabase configuration
 * -------------------------------------------------
 * • In Expo/React Native projects the public URL / anon key are
 *   exposed with the EXPO_PUBLIC_* prefix.
 * • In many server scripts we still reference SUPABASE_URL /
 *   SUPABASE_ANON_KEY.  Resolve whichever is present so the CLI
 *   works in both environments.
 */
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  '';

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';
const FEEDBACK_TAGS = [
  'DATE_FORMAT',
  'VENUE_MISSING',
  'ADDRESS_POOR',
  'DUPLICATE',
  'MULTI_EVENT_COLLAPSE',
  'EXTRA_HTML',
  'SPAM',
  'STATE_FULL',
  'CITY_MISSING'
];

// Global state
let config = {
  token: '',
  refreshToken: '',
  expiresAt: 0
};

// Load config if exists
if (fs.existsSync(CONFIG_FILE)) {
  try {
    config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE)) };
  } catch (e) {
    console.error('Error loading config:', e.message);
  }
}

// Save config
function saveConfig() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// API client
const api = axios.create({
  baseURL: `${SUPABASE_URL}/functions/v1/admin-review`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use(request => {
  if (config.token) {
    request.headers['Authorization'] = `Bearer ${config.token}`;
  }
  return request;
});

// Handle authentication
async function authenticate() {
  if (!SUPABASE_URL) {
    console.error(
      chalk.red(
        'Error: SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) environment variable is not set.'
      )
    );
    console.warn(
      'Please create a .env file with your Supabase credentials, e.g.\n' +
        'EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co\n' +
        'EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>'
    );
    process.exit(1);
  }

  // Check if token is still valid
  if (config.token && config.expiresAt > Date.now()) {
    return;
  }

  console.warn(chalk.yellow('Authentication required.'));
  
  const { email, password } = await inquirer.prompt([
    {
      type: 'input',
      name: 'email',
      message: 'Email:',
      validate: input => input.includes('@') ? true : 'Please enter a valid email'
    },
    {
      type: 'password',
      name: 'password',
      message: 'Password:',
      mask: '*'
    }
  ]);

  const spinner = ora('Authenticating...').start();
  
  try {
    const response = await axios.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      email,
      password
    }, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_ANON_KEY || ''
      }
    });

    config.token = response.data.access_token;
    config.refreshToken = response.data.refresh_token;
    config.expiresAt = Date.now() + response.data.expires_in * 1000;
    saveConfig();
    
    spinner.succeed('Authentication successful.');
  } catch (error) {
    spinner.fail('Authentication failed.');
    console.error(chalk.red(error.response?.data?.error_description || error.message));
    process.exit(1);
  }
}

// Format date
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  
  try {
    const date = new Date(dateStr);
    return dateFormat(date, 'mmm d, yyyy');
  } catch (e) {
    return dateStr;
  }
}

// Truncate string
function truncate(str, length = 30) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length - 3) + '...' : str;
}

// Display show details
function displayShow(show) {
  console.warn('\n' + chalk.bold.underline(`Show Details: ${show.raw_payload.name || 'Unnamed Show'}`));
  
  // Basic info
  console.warn(chalk.bold('Basic Info:'));
  console.warn(`  ${chalk.dim('ID:')} ${show.id}`);
  console.warn(`  ${chalk.dim('Source:')} ${show.source_url}`);
  console.warn(`  ${chalk.dim('Created:')} ${formatDate(show.created_at)}`);
  
  // Raw payload
  console.warn(chalk.bold('\nExtracted Data:'));
  const payload = show.raw_payload;
  console.warn(`  ${chalk.dim('Name:')} ${payload.name || 'N/A'}`);
  console.warn(`  ${chalk.dim('Dates:')} ${payload.startDate || 'N/A'} ${payload.endDate ? `to ${payload.endDate}` : ''}`);
  console.warn(`  ${chalk.dim('Venue:')} ${payload.venueName || 'N/A'}`);
  console.warn(`  ${chalk.dim('Location:')} ${[payload.address, payload.city, payload.state].filter(Boolean).join(', ') || 'N/A'}`);
  console.warn(`  ${chalk.dim('Entry Fee:')} ${payload.entryFee || 'N/A'}`);
  console.warn(`  ${chalk.dim('Contact:')} ${payload.contactInfo || 'N/A'}`);
  console.warn(`  ${chalk.dim('URL:')} ${payload.url || 'N/A'}`);
  
  if (payload.description) {
    console.warn(`  ${chalk.dim('Description:')}`);
    console.warn(`    ${payload.description.replace(/\n/g, '\n    ')}`);
  }
  
  // Quality assessment
  if (show.quality) {
    console.warn(chalk.bold('\nQuality Assessment:'));
    const scoreColor = show.quality.score >= 80 ? 'green' : (show.quality.score >= 50 ? 'yellow' : 'red');
    console.warn(`  ${chalk.dim('Score:')} ${chalk[scoreColor](show.quality.score)}/100`);
    
    if (show.quality.issues.length > 0) {
      console.warn(`  ${chalk.dim('Issues:')}`);
      show.quality.issues.forEach(issue => {
        console.warn(`    - ${issue}`);
      });
    }
    
    if (show.quality.recommendations.length > 0) {
      console.warn(`  ${chalk.dim('Recommendations:')}`);
      show.quality.recommendations.forEach(rec => {
        console.warn(`    - ${rec}`);
      });
    }
  }
  
  // Potential duplicates
  if (show.duplicates && show.duplicates.length > 0) {
    console.warn(chalk.bold('\nPotential Duplicates:'));
    show.duplicates.forEach((dup, i) => {
      console.warn(`  ${i + 1}. ${dup.name} (${dup.startDate}) - ID: ${dup.id}`);
    });
  }
  
  console.warn(); // Empty line at the end
}

// List pending shows
async function listPendingShows(options) {
  await authenticate();
  
  const spinner = ora('Loading pending shows...').start();
  
  try {
    const params = {
      limit: options.limit || 10,
      offset: (options.page - 1) * (options.limit || 10),
      source: options.source,
      minScore: options.minScore,
      maxScore: options.maxScore
    };
    
    const response = await api.get('/pending', { params });
    const { shows, pagination } = response.data;
    
    spinner.succeed(`Loaded ${shows.length} pending shows (${pagination.total} total)`);
    
    if (shows.length === 0) {
      console.warn(chalk.yellow('No pending shows found.'));
      return;
    }
    
    const table = new Table({
      columns: [
        { name: 'id', title: 'ID', alignment: 'left', color: 'blue' },
        { name: 'name', title: 'Name', alignment: 'left' },
        { name: 'date', title: 'Date', alignment: 'left' },
        { name: 'location', title: 'Location', alignment: 'left' },
        { name: 'score', title: 'Score', alignment: 'right' },
        { name: 'source', title: 'Source', alignment: 'left' },
        { name: 'created', title: 'Created', alignment: 'left' }
      ]
    });
    
    shows.forEach(show => {
      const payload = show.raw_payload;
      const scoreColor = show.quality.score >= 80 ? 'green' : (show.quality.score >= 50 ? 'yellow' : 'red');
      
      table.addRow({
        id: truncate(show.id, 8),
        name: truncate(payload.name || 'Unnamed', 25),
        date: truncate(payload.startDate || 'N/A', 12),
        location: truncate([payload.city, payload.state].filter(Boolean).join(', '), 20),
        score: { text: show.quality.score, color: scoreColor },
        source: truncate(new URL(show.source_url).hostname.replace('www.', ''), 20),
        created: formatDate(show.created_at)
      });
    });
    
    table.printTable();
    
    console.warn(`Page ${options.page} of ${Math.ceil(pagination.total / pagination.limit)}`);
    
    // Pagination or show details prompt
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'View show details', value: 'view' },
          { name: 'Next page', value: 'next', disabled: !pagination.hasMore },
          { name: 'Previous page', value: 'prev', disabled: options.page <= 1 },
          { name: 'Back to main menu', value: 'back' }
        ]
      }
    ]);
    
    if (action === 'view') {
      const { showIndex } = await inquirer.prompt([
        {
          type: 'number',
          name: 'showIndex',
          message: 'Enter the row number to view (1-' + shows.length + '):',
          validate: input => {
            const num = parseInt(input);
            return num >= 1 && num <= shows.length ? true : 'Please enter a valid row number';
          },
          filter: input => parseInt(input)
        }
      ]);
      
      const selectedShow = shows[showIndex - 1];
      displayShow(selectedShow);
      await showActions(selectedShow);
    } else if (action === 'next') {
      await listPendingShows({ ...options, page: options.page + 1 });
    } else if (action === 'prev') {
      await listPendingShows({ ...options, page: options.page - 1 });
    }
  } catch (error) {
    spinner.fail('Failed to load pending shows');
    console.error(chalk.red(error.response?.data?.error || error.message));
  }
}

// Show actions (approve, reject, edit)
async function showActions(show) {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do with this show?',
      choices: [
        { name: 'Approve', value: 'approve' },
        { name: 'Reject', value: 'reject' },
        { name: 'Edit and approve', value: 'edit' },
        { name: 'Back', value: 'back' }
      ]
    }
  ]);
  
  if (action === 'back') {
    return;
  }
  
  if (action === 'approve') {
    const { feedback } = await inquirer.prompt([
      {
        type: 'input',
        name: 'feedback',
        message: 'Add any feedback (optional):',
      }
    ]);
    
    const spinner = ora('Approving show...').start();
    
    try {
      const response = await api.post('/approve', {
        id: show.id,
        feedback
      });
      
      spinner.succeed('Show approved successfully');
      console.warn(chalk.green('The show has been approved and will be processed by the normalizer.'));
    } catch (error) {
      spinner.fail('Failed to approve show');
      console.error(chalk.red(error.response?.data?.error || error.message));
    }
  } else if (action === 'reject') {
    // Select feedback tags
    const { selectedTags } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedTags',
        message: 'Select feedback tags:',
        choices: FEEDBACK_TAGS.map(tag => ({ name: tag, value: tag }))
      }
    ]);
    
    // Additional feedback
    const { additionalFeedback } = await inquirer.prompt([
      {
        type: 'input',
        name: 'additionalFeedback',
        message: 'Add additional feedback (optional):',
      }
    ]);
    
    // Combine tags and feedback
    const feedback = selectedTags.length > 0 
      ? `${selectedTags.join(', ')}${additionalFeedback ? ' - ' + additionalFeedback : ''}`
      : additionalFeedback;
    
    const spinner = ora('Rejecting show...').start();
    
    try {
      const response = await api.post('/reject', {
        id: show.id,
        feedback
      });
      
      spinner.succeed('Show rejected successfully');
    } catch (error) {
      spinner.fail('Failed to reject show');
      console.error(chalk.red(error.response?.data?.error || error.message));
    }
  } else if (action === 'edit') {
    // Get the raw payload for editing
    const payload = { ...show.raw_payload };
    
    // Fields to edit
    const fields = [
      { name: 'name', label: 'Name' },
      { name: 'startDate', label: 'Start Date' },
      { name: 'endDate', label: 'End Date' },
      { name: 'venueName', label: 'Venue Name' },
      { name: 'address', label: 'Address' },
      { name: 'city', label: 'City' },
      { name: 'state', label: 'State' },
      { name: 'entryFee', label: 'Entry Fee' },
      { name: 'contactInfo', label: 'Contact Info' },
      { name: 'url', label: 'URL' },
      { name: 'description', label: 'Description' }
    ];
    
    // Edit each field
    for (const field of fields) {
      const { edit } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'edit',
          message: `Edit ${field.label}? (Current: ${payload[field.name] || 'N/A'})`,
          default: false
        }
      ]);
      
      if (edit) {
        const { value } = await inquirer.prompt([
          {
            type: field.name === 'description' ? 'editor' : 'input',
            name: 'value',
            message: `Enter new ${field.label}:`,
            default: payload[field.name] || ''
          }
        ]);
        
        payload[field.name] = value;
      }
    }
    
    // Confirm changes
    console.warn(chalk.bold('\nUpdated Show Data:'));
    Object.entries(payload).forEach(([key, value]) => {
      if (value) {
        console.warn(`  ${chalk.dim(key + ':')} ${value}`);
      }
    });
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Save changes and approve?',
        default: true
      }
    ]);
    
    if (confirm) {
      // Add feedback
      const { feedback } = await inquirer.prompt([
        {
          type: 'input',
          name: 'feedback',
          message: 'Add any feedback about your edits (optional):',
        }
      ]);
      
      const spinner = ora('Saving changes and approving...').start();
      
      try {
        const response = await api.post('/edit', {
          id: show.id,
          raw_payload: payload,
          feedback
        });
        
        spinner.succeed('Show edited and approved successfully');
        console.warn(chalk.green('The show has been updated, approved, and will be processed by the normalizer.'));
      } catch (error) {
        spinner.fail('Failed to edit and approve show');
        console.error(chalk.red(error.response?.data?.error || error.message));
      }
    }
  }
}

// Batch operations
async function batchOperations(options) {
  await authenticate();
  
  const spinner = ora('Loading pending shows for batch operation...').start();
  
  try {
    const params = {
      limit: options.limit || 50,
      offset: 0,
      source: options.source,
      minScore: options.minScore || 80 // Default to high quality shows for batch operations
    };
    
    const response = await api.get('/pending', { params });
    const { shows } = response.data;
    
    spinner.succeed(`Loaded ${shows.length} pending shows for batch operation`);
    
    if (shows.length === 0) {
      console.warn(chalk.yellow('No pending shows found matching the criteria.'));
      return;
    }
    
    // Display shows in a table
    const table = new Table({
      columns: [
        { name: 'index', title: '#', alignment: 'right' },
        { name: 'name', title: 'Name', alignment: 'left' },
        { name: 'date', title: 'Date', alignment: 'left' },
        { name: 'location', title: 'Location', alignment: 'left' },
        { name: 'score', title: 'Score', alignment: 'right' },
        { name: 'source', title: 'Source', alignment: 'left' }
      ]
    });
    
    shows.forEach((show, index) => {
      const payload = show.raw_payload;
      const scoreColor = show.quality.score >= 80 ? 'green' : (show.quality.score >= 50 ? 'yellow' : 'red');
      
      table.addRow({
        index: index + 1,
        name: truncate(payload.name || 'Unnamed', 25),
        date: truncate(payload.startDate || 'N/A', 12),
        location: truncate([payload.city, payload.state].filter(Boolean).join(', '), 20),
        score: { text: show.quality.score, color: scoreColor },
        source: truncate(new URL(show.source_url).hostname.replace('www.', ''), 20)
      });
    });
    
    table.printTable();
    
    // Select shows for batch operation
    const { selectMethod } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectMethod',
        message: 'How would you like to select shows?',
        choices: [
          { name: 'Select all', value: 'all' },
          { name: 'Select by range', value: 'range' },
          { name: 'Select individually', value: 'individual' },
          { name: 'Back', value: 'back' }
        ]
      }
    ]);
    
    if (selectMethod === 'back') {
      return;
    }
    
    let selectedIndices = [];
    
    if (selectMethod === 'all') {
      selectedIndices = shows.map((_, i) => i);
    } else if (selectMethod === 'range') {
      const { start, end } = await inquirer.prompt([
        {
          type: 'number',
          name: 'start',
          message: 'Start index (1-' + shows.length + '):',
          validate: input => {
            const num = parseInt(input);
            return num >= 1 && num <= shows.length ? true : 'Please enter a valid index';
          },
          filter: input => parseInt(input) - 1 // Convert to 0-based index
        },
        {
          type: 'number',
          name: 'end',
          message: 'End index (1-' + shows.length + '):',
          validate: (input, answers) => {
            const num = parseInt(input);
            return num >= answers.start + 1 && num <= shows.length ? true : 'Please enter a valid index';
          },
          filter: input => parseInt(input) - 1 // Convert to 0-based index
        }
      ]);
      
      for (let i = start; i <= end; i++) {
        selectedIndices.push(i);
      }
    } else if (selectMethod === 'individual') {
      const { indices } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'indices',
          message: 'Select shows:',
          choices: shows.map((show, i) => ({
            name: `${i + 1}. ${show.raw_payload.name || 'Unnamed'} (${show.raw_payload.startDate || 'N/A'})`,
            value: i
          }))
        }
      ]);
      
      selectedIndices = indices;
    }
    
    if (selectedIndices.length === 0) {
      console.warn(chalk.yellow('No shows selected.'));
      return;
    }
    
    // Select action
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `What action would you like to perform on ${selectedIndices.length} selected shows?`,
        choices: [
          { name: 'Approve all', value: 'approve' },
          { name: 'Reject all', value: 'reject' },
          { name: 'Cancel', value: 'cancel' }
        ]
      }
    ]);
    
    if (action === 'cancel') {
      return;
    }
    
    // Add feedback
    let feedback = '';
    
    if (action === 'approve') {
      const { approvalFeedback } = await inquirer.prompt([
        {
          type: 'input',
          name: 'approvalFeedback',
          message: 'Add any feedback for all approved shows (optional):',
        }
      ]);
      
      feedback = approvalFeedback;
    } else if (action === 'reject') {
      // Select feedback tags
      const { selectedTags } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selectedTags',
          message: 'Select feedback tags:',
          choices: FEEDBACK_TAGS.map(tag => ({ name: tag, value: tag }))
        }
      ]);
      
      // Additional feedback
      const { additionalFeedback } = await inquirer.prompt([
        {
          type: 'input',
          name: 'additionalFeedback',
          message: 'Add additional feedback (optional):',
        }
      ]);
      
      // Combine tags and feedback
      feedback = selectedTags.length > 0 
        ? `${selectedTags.join(', ')}${additionalFeedback ? ' - ' + additionalFeedback : ''}`
        : additionalFeedback;
    }
    
    // Confirm action
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to ${action} ${selectedIndices.length} shows?`,
        default: false
      }
    ]);
    
    if (!confirm) {
      console.warn(chalk.yellow('Operation cancelled.'));
      return;
    }
    
    // Perform batch action
    const selectedIds = selectedIndices.map(i => shows[i].id);
    const spinner = ora(`Performing batch ${action}...`).start();
    
    try {
      const response = await api.post('/batch', {
        action,
        ids: selectedIds,
        feedback
      });
      
      spinner.succeed(`Batch ${action} completed successfully`);
      console.error(chalk.green(`${response.data.shows.length} shows were ${action === 'approve' ? 'approved' : 'rejected'}.`));
      
      if (action === 'approve') {
        console.warn(chalk.green('The shows have been approved and will be processed by the normalizer.'));
      }
    } catch (error) {
      spinner.fail(`Failed to perform batch ${action}`);
      console.error(chalk.red(error.response?.data?.error || error.message));
    }
  } catch (error) {
    spinner.fail('Failed to load pending shows');
    console.error(chalk.red(error.response?.data?.error || error.message));
  }
}

// View statistics
async function viewStatistics(options) {
  await authenticate();
  
  const spinner = ora('Loading statistics...').start();
  
  try {
    const params = {
      days: options.days || 7
    };
    
    const response = await api.get('/stats', { params });
    const { feedback, sources } = response.data;
    
    spinner.succeed('Statistics loaded successfully');
    
    // Display feedback stats
    console.warn(chalk.bold.underline(`\nFeedback Statistics (Last ${params.days} days):`));
    
    if (feedback.length === 0) {
      console.warn(chalk.yellow('No feedback data available for this period.'));
    } else {
      const feedbackTable = new Table({
        columns: [
          { name: 'tag', title: 'Tag', alignment: 'left' },
          { name: 'count', title: 'Count', alignment: 'right' },
          { name: 'percentage', title: 'Percentage', alignment: 'right' },
          { name: 'topSources', title: 'Top Sources', alignment: 'left' }
        ]
      });
      
      feedback.forEach(item => {
        // Get top 3 sources for this tag
        const sources = Object.entries(item.source_distribution || {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([url, count]) => `${new URL(url).hostname.replace('www.', '')} (${count})`)
          .join(', ');
        
        feedbackTable.addRow({
          tag: item.tag,
          count: item.count,
          percentage: item.percentage + '%',
          topSources: truncate(sources, 40)
        });
      });
      
      feedbackTable.printTable();
    }
    
    // Display source stats
    console.warn(chalk.bold.underline(`\nSource Statistics (Last ${params.days} days):`));
    
    if (sources.length === 0) {
      console.warn(chalk.yellow('No source data available for this period.'));
    } else {
      const sourceTable = new Table({
        columns: [
          { name: 'source', title: 'Source', alignment: 'left' },
          { name: 'total', title: 'Total', alignment: 'right' },
          { name: 'approved', title: 'Approved', alignment: 'right' },
          { name: 'rejected', title: 'Rejected', alignment: 'right' },
          { name: 'pending', title: 'Pending', alignment: 'right' },
          { name: 'approvalRate', title: 'Approval %', alignment: 'right' },
          { name: 'topIssues', title: 'Top Issues', alignment: 'left' }
        ]
      });
      
      sources.forEach(item => {
        // Get top 2 issues for this source
        const issues = Object.entries(item.common_issues || {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([tag, count]) => `${tag} (${count})`)
          .join(', ');
        
        const approvalColor = item.approval_rate >= 80 ? 'green' : (item.approval_rate >= 50 ? 'yellow' : 'red');
        
        sourceTable.addRow({
          source: truncate(new URL(item.source_url).hostname.replace('www.', ''), 20),
          total: item.total_shows,
          approved: item.approved_count,
          rejected: item.rejected_count,
          pending: item.pending_count,
          approvalRate: { text: item.approval_rate + '%', color: approvalColor },
          topIssues: truncate(issues, 30)
        });
      });
      
      sourceTable.printTable();
    }
    
    // Recommendations based on stats
    console.warn(chalk.bold.underline('\nRecommendations:'));
    
    if (feedback.length > 0) {
      const topIssue = feedback[0];
      console.warn(`1. Focus on fixing "${topIssue.tag}" issues (${topIssue.percentage}% of feedback).`);
      
      // Find sources with low approval rates
      const lowApprovalSources = sources
        .filter(s => s.approval_rate < 50 && s.total_shows >= 5)
        .sort((a, b) => a.approval_rate - b.approval_rate);
      
      if (lowApprovalSources.length > 0) {
        const worstSource = lowApprovalSources[0];
        console.warn(`2. Consider tuning the scraper for ${new URL(worstSource.source_url).hostname.replace('www.', '')} (only ${worstSource.approval_rate}% approval rate).`);
      }
      
      // Check for common issues
      const dateFormatIssue = feedback.find(f => f.tag === 'DATE_FORMAT');
      if (dateFormatIssue && dateFormatIssue.percentage > 20) {
        console.warn(`3. Improve date parsing in the scraper (${dateFormatIssue.percentage}% of shows have date format issues).`);
      }
      
      const multiEventIssue = feedback.find(f => f.tag === 'MULTI_EVENT_COLLAPSE');
      if (multiEventIssue && multiEventIssue.percentage > 10) {
        console.warn(`4. Reduce chunk size for HTML processing (${multiEventIssue.percentage}% of shows have multiple events collapsed).`);
      }
    } else {
      console.warn(chalk.yellow('Not enough data to generate recommendations.'));
    }
  } catch (error) {
    spinner.fail('Failed to load statistics');
    console.error(chalk.red(error.response?.data?.error || error.message));
  }
}

// Find duplicates
async function findDuplicates() {
  await authenticate();
  
  const spinner = ora('Finding potential duplicates...').start();
  
  try {
    const response = await api.get('/duplicates');
    const { duplicates } = response.data;
    
    spinner.succeed(`Found ${duplicates.length} potential duplicate pairs`);
    
    if (duplicates.length === 0) {
      console.warn(chalk.yellow('No potential duplicates found.'));
      return;
    }
    
    // Display duplicates
    console.warn(chalk.bold.underline('\nPotential Duplicates:'));
    
    duplicates.forEach((dup, index) => {
      console.warn(chalk.bold(`\nDuplicate Pair #${index + 1} (${Math.round(dup.similarity * 100)}% similar):`));
      
      console.warn(chalk.dim('Show 1:'));
      console.warn(`  ID: ${dup.id1}`);
      console.warn(`  Name: ${dup.name1}`);
      console.warn(`  Date: ${dup.start_date1}`);
      console.warn(`  Location: ${[dup.city1, dup.state1].filter(Boolean).join(', ')}`);
      console.warn(`  Source: ${dup.source_url1}`);
      console.warn(`  Created: ${formatDate(dup.created_at1)}`);
      
      console.warn(chalk.dim('\nShow 2:'));
      console.warn(`  ID: ${dup.id2}`);
      console.warn(`  Name: ${dup.name2}`);
      console.warn(`  Date: ${dup.start_date2}`);
      console.warn(`  Location: ${[dup.city2, dup.state2].filter(Boolean).join(', ')}`);
      console.warn(`  Source: ${dup.source_url2}`);
      console.warn(`  Created: ${formatDate(dup.created_at2)}`);
      
      // Resolve duplicates
      inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'How would you like to resolve this duplicate?',
          choices: [
            { name: 'Keep both (not duplicates)', value: 'keep' },
            { name: 'Keep Show 1, reject Show 2', value: 'keep1' },
            { name: 'Keep Show 2, reject Show 1', value: 'keep2' },
            { name: 'Reject both', value: 'reject' },
            { name: 'Skip for now', value: 'skip' }
          ]
        }
      ]).then(async ({ action }) => {
        if (action === 'skip') {
          if (index < duplicates.length - 1) {
            // Continue to next duplicate
            return;
          } else {
            console.warn(chalk.green('Finished reviewing duplicates.'));
            return;
          }
        }
        
        // Get feedback
        const { feedback } = await inquirer.prompt([
          {
            type: 'input',
            name: 'feedback',
            message: 'Add any feedback (optional):',
            default: action === 'keep' ? '' : 'DUPLICATE'
          }
        ]);
        
        const actionSpinner = ora('Resolving duplicate...').start();
        
        try {
          // Handle different actions
          if (action === 'keep') {
            // Do nothing, keep both
            actionSpinner.succeed('Both shows kept');
          } else if (action === 'keep1') {
            // Approve show 1, reject show 2
            await api.post('/approve', { id: dup.id1, feedback });
            await api.post('/reject', { id: dup.id2, feedback });
            actionSpinner.succeed('Show 1 approved, Show 2 rejected');
          } else if (action === 'keep2') {
            // Approve show 2, reject show 1
            await api.post('/approve', { id: dup.id2, feedback });
            await api.post('/reject', { id: dup.id1, feedback });
            actionSpinner.succeed('Show 2 approved, Show 1 rejected');
          } else if (action === 'reject') {
            // Reject both
            await api.post('/reject', { id: dup.id1, feedback });
            await api.post('/reject', { id: dup.id2, feedback });
            actionSpinner.succeed('Both shows rejected');
          }
          
          // Continue to next duplicate if available
          if (index < duplicates.length - 1) {
            // Continue
          } else {
            console.warn(chalk.green('Finished reviewing duplicates.'));
          }
        } catch (error) {
          actionSpinner.fail('Failed to resolve duplicate');
          console.error(chalk.red(error.response?.data?.error || error.message));
        }
      });
    });
  } catch (error) {
    spinner.fail('Failed to find duplicates');
    console.error(chalk.red(error.response?.data?.error || error.message));
  }
}

// Export data
async function exportData(options) {
  await authenticate();
  
  const { exportType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'exportType',
      message: 'What would you like to export?',
      choices: [
        { name: 'Pending shows', value: 'pending' },
        { name: 'Statistics', value: 'stats' },
        { name: 'Feedback analysis', value: 'feedback' },
        { name: 'Cancel', value: 'cancel' }
      ]
    }
  ]);
  
  if (exportType === 'cancel') {
    return;
  }
  
  // Select format
  const { format } = await inquirer.prompt([
    {
      type: 'list',
      name: 'format',
      message: 'Export format:',
      choices: [
        { name: 'CSV', value: 'csv' },
        { name: 'JSON', value: 'json' }
      ]
    }
  ]);
  
  // Get filename
  const { filename } = await inquirer.prompt([
    {
      type: 'input',
      name: 'filename',
      message: 'Enter filename (without extension):',
      default: `${exportType}_export_${dateFormat(new Date(), 'yyyymmdd')}`
    }
  ]);
  
  const spinner = ora(`Exporting ${exportType} data...`).start();
  
  try {
    let data;
    let headers;
    
    if (exportType === 'pending') {
      // Export all pending shows
      const response = await api.get('/pending', { params: { limit: 1000 } });
      data = response.data.shows;
      
      // Flatten the data for CSV export
      if (format === 'csv') {
        data = data.map(show => ({
          id: show.id,
          source_url: show.source_url,
          created_at: show.created_at,
          name: show.raw_payload.name,
          startDate: show.raw_payload.startDate,
          endDate: show.raw_payload.endDate,
          venueName: show.raw_payload.venueName,
          address: show.raw_payload.address,
          city: show.raw_payload.city,
          state: show.raw_payload.state,
          entryFee: show.raw_payload.entryFee,
          contactInfo: show.raw_payload.contactInfo,
          url: show.raw_payload.url,
          quality_score: show.quality?.score
        }));
        
        headers = [
          { id: 'id', title: 'ID' },
          { id: 'source_url', title: 'Source URL' },
          { id: 'created_at', title: 'Created At' },
          { id: 'name', title: 'Name' },
          { id: 'startDate', title: 'Start Date' },
          { id: 'endDate', title: 'End Date' },
          { id: 'venueName', title: 'Venue Name' },
          { id: 'address', title: 'Address' },
          { id: 'city', title: 'City' },
          { id: 'state', title: 'State' },
          { id: 'entryFee', title: 'Entry Fee' },
          { id: 'contactInfo', title: 'Contact Info' },
          { id: 'url', title: 'URL' },
          { id: 'quality_score', title: 'Quality Score' }
        ];
      }
    } else if (exportType === 'stats' || exportType === 'feedback') {
      const response = await api.get('/stats', { params: { days: options.days || 30 } });
      
      if (exportType === 'stats') {
        data = response.data.sources;
        
        if (format === 'csv') {
          // Flatten common_issues for CSV
          data = data.map(source => ({
            source_url: source.source_url,
            total_shows: source.total_shows,
            approved_count: source.approved_count,
            rejected_count: source.rejected_count,
            pending_count: source.pending_count,
            approval_rate: source.approval_rate,
            rejection_rate: source.rejection_rate,
            avg_quality_score: source.avg_quality_score,
            // Extract top issues
            top_issue_1: Object.keys(source.common_issues)[0] || '',
            top_issue_1_count: Object.values(source.common_issues)[0] || 0,
            top_issue_2: Object.keys(source.common_issues)[1] || '',
            top_issue_2_count: Object.values(source.common_issues)[1] || 0
          }));
          
          headers = [
            { id: 'source_url', title: 'Source URL' },
            { id: 'total_shows', title: 'Total Shows' },
            { id: 'approved_count', title: 'Approved' },
            { id: 'rejected_count', title: 'Rejected' },
            { id: 'pending_count', title: 'Pending' },
            { id: 'approval_rate', title: 'Approval Rate %' },
            { id: 'rejection_rate', title: 'Rejection Rate %' },
            { id: 'avg_quality_score', title: 'Avg Quality Score' },
            { id: 'top_issue_1', title: 'Top Issue 1' },
            { id: 'top_issue_1_count', title: 'Count 1' },
            { id: 'top_issue_2', title: 'Top Issue 2' },
            { id: 'top_issue_2_count', title: 'Count 2' }
          ];
        }
      } else {
        data = response.data.feedback;
        
        if (format === 'csv') {
          // Flatten source_distribution for CSV
          data = data.map(item => ({
            tag: item.tag,
            count: item.count,
            percentage: item.percentage,
            // Extract top sources
            top_source_1: Object.keys(item.source_distribution)[0] || '',
            top_source_1_count: Object.values(item.source_distribution)[0] || 0,
            top_source_2: Object.keys(item.source_distribution)[1] || '',
            top_source_2_count: Object.values(item.source_distribution)[1] || 0,
            top_source_3: Object.keys(item.source_distribution)[2] || '',
            top_source_3_count: Object.values(item.source_distribution)[2] || 0
          }));
          
          headers = [
            { id: 'tag', title: 'Tag' },
            { id: 'count', title: 'Count' },
            { id: 'percentage', title: 'Percentage %' },
            { id: 'top_source_1', title: 'Top Source 1' },
            { id: 'top_source_1_count', title: 'Count 1' },
            { id: 'top_source_2', title: 'Top Source 2' },
            { id: 'top_source_2_count', title: 'Count 2' },
            { id: 'top_source_3', title: 'Top Source 3' },
            { id: 'top_source_3_count', title: 'Count 3' }
          ];
        }
      }
    }
    
    const outputPath = path.join(process.cwd(), `${filename}.${format}`);
    
    if (format === 'json') {
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    } else if (format === 'csv') {
      const csvWriter = createObjectCsvWriter({
        path: outputPath,
        header: headers
      });
      
      await csvWriter.writeRecords(data);
    }
    
    spinner.succeed(`Data exported to ${outputPath}`);
    
    // Ask if user wants to open the file
    const { openFile } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'openFile',
        message: 'Open the exported file?',
        default: false
      }
    ]);
    
    if (openFile) {
      open(outputPath);
    }
  } catch (error) {
    spinner.fail(`Failed to export ${exportType} data`);
    console.error(chalk.red(error.response?.data?.error || error.message));
  }
}

// Main menu
async function mainMenu() {
  console.warn(chalk.bold.green('\nCard Show Finder - Admin Review CLI'));
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'List pending shows', value: 'list' },
        { name: 'Batch operations', value: 'batch' },
        { name: 'View statistics', value: 'stats' },
        { name: 'Find duplicates', value: 'duplicates' },
        { name: 'Export data', value: 'export' },
        { name: 'Exit', value: 'exit' }
      ]
    }
  ]);
  
  if (action === 'exit') {
    console.warn(chalk.green('Goodbye!'));
    process.exit(0);
  }
  
  if (action === 'list') {
    await listPendingShows({ page: 1, limit: 10 });
  } else if (action === 'batch') {
    await batchOperations({});
  } else if (action === 'stats') {
    await viewStatistics({});
  } else if (action === 'duplicates') {
    await findDuplicates();
  } else if (action === 'export') {
    await exportData({});
  }
  
  // Return to main menu
  await mainMenu();
}

// Define commands
program
  .name('admin-review')
  .description('Card Show Finder - Admin Review CLI')
  .version('1.0.0');

program
  .command('list')
  .description('List pending shows with quality scores')
  .option('-p, --page <number>', 'Page number', 1)
  .option('-l, --limit <number>', 'Number of shows per page', 10)
  .option('-s, --source <url>', 'Filter by source URL')
  .option('--min-score <number>', 'Minimum quality score', 0)
  .option('--max-score <number>', 'Maximum quality score', 100)
  .action(listPendingShows);

program
  .command('batch')
  .description('Batch operations for efficient processing')
  .option('-l, --limit <number>', 'Number of shows to process', 50)
  .option('-s, --source <url>', 'Filter by source URL')
  .option('--min-score <number>', 'Minimum quality score', 80)
  .action(batchOperations);

program
  .command('stats')
  .description('View statistics and feedback patterns')
  .option('-d, --days <number>', 'Number of days to analyze', 7)
  .action(viewStatistics);

program
  .command('duplicates')
  .description('Find and resolve duplicates')
  .action(findDuplicates);

program
  .command('export')
  .description('Export data for analysis')
  .option('-d, --days <number>', 'Number of days to include in stats/feedback', 30)
  .action(exportData);

program
  .command('menu')
  .description('Start interactive menu')
  .action(mainMenu);

// Default command
if (process.argv.length === 2) {
  mainMenu();
} else {
  program.parse(process.argv);
}
