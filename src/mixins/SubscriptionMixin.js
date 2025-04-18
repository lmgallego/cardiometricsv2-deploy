import SubscriptionManager from '../services/SubscriptionManager'
import log from '@/log'

/**
 * Mixin that provides subscription management functionality
 * to Vue components
 */
export default {
  data() {
    return {
      subManager: new SubscriptionManager()
    }
  },
  
  methods: {
    /**
     * Subscribe to an observable and automatically manage cleanup
     * 
     * @param {string} key - Unique identifier for this subscription
     * @param {Observable} observable - The observable to subscribe to
     * @param {function} nextHandler - Handler for emitted values
     * @param {function} [errorHandler] - Optional error handler
     * @param {function} [completeHandler] - Optional complete handler
     * @returns {Subscription} - The subscription object (rarely needed)
     */
    safeSubscribe(key, observable, nextHandler, errorHandler, completeHandler) {
      return this.subManager.subscribe(
        key, 
        observable, 
        nextHandler, 
        errorHandler, 
        completeHandler
      )
    },
    
    /**
     * Manually unsubscribe from a specific subscription
     * 
     * @param {string} key - Identifier for the subscription to remove
     */
    safeUnsubscribe(key) {
      this.subManager.remove(key)
    },
    
    /**
     * Unsubscribe from all subscriptions managed by this component
     */
    unsubscribeAll() {
      this.subManager.removeAll()
    }
  },
  
  beforeDestroy() {
    // Clean up all subscriptions when component is destroyed
    this.unsubscribeAll()
    log.debug('SubscriptionMixin: cleaned up all subscriptions')
  }
} 