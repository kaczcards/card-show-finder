/**
 * Test Utility for Chat Integration
 * 
 * This file provides functions to test the integration between React Query hooks
 * and PostgreSQL RPC functions for the chat functionality.
 * 
 * FOR DEVELOPMENT/TESTING ONLY - Not for production use
 */

import { supabase } from '../supabase';
import * as messagingService from '../services/messagingService';

/**
 * Test the get_user_conversations RPC function and compare with service method
 * @param userId The user ID to fetch conversations for
 */
export const testConversationsIntegration = async (userId: string) => {
  console.group('🧪 TESTING CONVERSATIONS INTEGRATION');
  console.time('Total test time');
  
  try {
    // Test RPC function
    console.group('1. Testing get_user_conversations RPC function');
    console.time('RPC execution time');
    
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_user_conversations', { 
        input_user_id: userId 
      });
      
    console.timeEnd('RPC execution time');
    
    if (rpcError) {
      console.error('❌ RPC ERROR:', rpcError.message);
      console.error('Details:', rpcError);
    } else if (!rpcData || !Array.isArray(rpcData)) {
      console.error('❌ RPC returned invalid data format:', rpcData);
    } else {
      console.log('✅ RPC SUCCESS - Returned', rpcData.length, 'conversations');
      console.log('First conversation sample:', rpcData[0] || 'No conversations');
    }
    console.groupEnd();
    
    // Test service method for comparison
    console.group('2. Testing messagingService.getConversations');
    console.time('Service execution time');
    
    try {
      const serviceData = await messagingService.getConversations(userId);
      console.timeEnd('Service execution time');
      console.log('✅ SERVICE SUCCESS - Returned', serviceData.length, 'conversations');
      console.log('First conversation sample:', serviceData[0] || 'No conversations');
      
      // Compare results
      if (rpcData && serviceData) {
        console.group('3. Comparing results');
        console.log('RPC count:', rpcData.length, '| Service count:', serviceData.length);
        
        if (rpcData.length > 0 && serviceData.length > 0) {
          // Check if IDs match
          const rpcIds = new Set(rpcData.map(c => c.id));
          const serviceIds = new Set(serviceData.map(c => c.id));
          
          const missingInRpc = [...serviceIds].filter(id => !rpcIds.has(id));
          const missingInService = [...rpcIds].filter(id => !serviceIds.has(id));
          
          if (missingInRpc.length > 0) {
            console.warn('⚠️ IDs in service but missing in RPC:', missingInRpc);
          }
          
          if (missingInService.length > 0) {
            console.warn('⚠️ IDs in RPC but missing in service:', missingInService);
          }
          
          if (missingInRpc.length === 0 && missingInService.length === 0) {
            console.log('✅ ID sets match between RPC and service');
          }
          
          // Compare structure of first item
          const rpcSample = rpcData[0];
          const serviceSample = serviceData[0];
          
          console.log('RPC first item keys:', Object.keys(rpcSample));
          console.log('Service first item keys:', Object.keys(serviceSample));
          
          // Check for missing fields
          const rpcFields = new Set(Object.keys(rpcSample));
          const serviceFields = new Set(Object.keys(serviceSample));
          
          const missingInRpcFields = [...serviceFields].filter(field => !rpcFields.has(field));
          const missingInServiceFields = [...rpcFields].filter(field => !serviceFields.has(field));
          
          if (missingInRpcFields.length > 0) {
            console.warn('⚠️ Fields in service but missing in RPC:', missingInRpcFields);
          }
          
          if (missingInServiceFields.length > 0) {
            console.warn('⚠️ Fields in RPC but missing in service:', missingInServiceFields);
          }
        }
        console.groupEnd();
      }
    } catch (serviceError) {
      console.timeEnd('Service execution time');
      console.error('❌ SERVICE ERROR:', serviceError);
    }
    console.groupEnd();
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
  }
  
  console.timeEnd('Total test time');
  console.groupEnd();
};

/**
 * Test the get_conversation_messages RPC function and compare with service method
 * @param conversationId The conversation ID to fetch messages for
 */
export const testMessagesIntegration = async (conversationId: string) => {
  console.group('🧪 TESTING MESSAGES INTEGRATION');
  console.time('Total test time');
  
  try {
    // Test RPC function
    console.group('1. Testing get_conversation_messages RPC function');
    console.time('RPC execution time');
    
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_conversation_messages', { 
        input_convo_id: conversationId 
      });
      
    console.timeEnd('RPC execution time');
    
    if (rpcError) {
      console.error('❌ RPC ERROR:', rpcError.message);
      console.error('Details:', rpcError);
    } else if (!rpcData || !Array.isArray(rpcData)) {
      console.error('❌ RPC returned invalid data format:', rpcData);
    } else {
      console.log('✅ RPC SUCCESS - Returned', rpcData.length, 'messages');
      console.log('First message sample:', rpcData[0] || 'No messages');
      
      // Verify field mapping
      if (rpcData.length > 0) {
        const firstMessage = rpcData[0];
        console.log('Field mapping check:');
        console.log('- message_id:', firstMessage.message_id);
        console.log('- conversation_id:', firstMessage.conversation_id);
        console.log('- sender_profile:', firstMessage.sender_profile);
      }
    }
    console.groupEnd();
    
    // Test service method for comparison
    console.group('2. Testing messagingService.getMessages');
    console.time('Service execution time');
    
    try {
      const serviceData = await messagingService.getMessages(conversationId);
      console.timeEnd('Service execution time');
      console.log('✅ SERVICE SUCCESS - Returned', serviceData.length, 'messages');
      console.log('First message sample:', serviceData[0] || 'No messages');
      
      // Compare results
      if (rpcData && serviceData) {
        console.group('3. Comparing results');
        console.log('RPC count:', rpcData.length, '| Service count:', serviceData.length);
        
        if (rpcData.length > 0 && serviceData.length > 0) {
          // Check structure differences
          const rpcSample = rpcData[0];
          const serviceSample = serviceData[0];
          
          console.log('RPC first item fields:', Object.keys(rpcSample));
          console.log('Service first item fields:', Object.keys(serviceSample));
          
          // Check field mapping needed
          console.log('Field mapping needed:');
          console.log('- RPC message_id → Service id');
          console.log('- RPC conversation_id → Service conversation_id');
          
          // Verify content matches (after mapping)
          if (rpcSample.message_id !== serviceSample.id) {
            console.warn('⚠️ ID mismatch between RPC and service');
          } else {
            console.log('✅ IDs match after mapping');
          }
          
          if (rpcSample.message_text !== serviceSample.message_text) {
            console.warn('⚠️ Content mismatch between RPC and service');
          } else {
            console.log('✅ Message content matches');
          }
        }
        console.groupEnd();
      }
    } catch (serviceError) {
      console.timeEnd('Service execution time');
      console.error('❌ SERVICE ERROR:', serviceError);
    }
    console.groupEnd();
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
  }
  
  console.timeEnd('Total test time');
  console.groupEnd();
};

/**
 * Run all integration tests
 * @param userId The user ID to test with
 * @param conversationId Optional conversation ID to test with (if not provided, will use the first conversation found)
 */
export const runAllIntegrationTests = async (userId: string, conversationId?: string) => {
  console.group('🧪🧪 RUNNING ALL CHAT INTEGRATION TESTS 🧪🧪');
  console.log('Testing with user ID:', userId);
  
  // First test conversations
  await testConversationsIntegration(userId);
  
  // If conversationId not provided, try to get one from the conversations test
  if (!conversationId) {
    try {
      const { data } = await supabase
        .rpc('get_user_conversations', { input_user_id: userId });
      
      if (data && Array.isArray(data) && data.length > 0) {
        conversationId = data[0].id;
        console.log('Using first conversation ID for messages test:', conversationId);
      } else {
        console.warn('No conversations found, skipping messages test');
      }
    } catch (error) {
      console.error('Failed to get conversation ID:', error);
    }
  }
  
  // Then test messages if we have a conversation ID
  if (conversationId) {
    await testMessagesIntegration(conversationId);
  }
  
  console.groupEnd();
  console.log('🏁 All tests completed');
};

/**
 * How to use this test utility:
 * 
 * 1. Import this file in a component or development screen
 * 2. Call one of the test functions with appropriate parameters
 * 3. Check the console for results
 * 
 * Example:
 * ```
 * import { runAllIntegrationTests } from '../utils/testChatIntegration';
 * 
 * // In a component or effect
 * runAllIntegrationTests('your-user-id-here');
 * ```
 */
