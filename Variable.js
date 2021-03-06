(function (root, factory) { if (typeof define === 'function' && define.amd) {
        define(['./util/lang'], factory)
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./util/lang'))
    } else {
        root.alkali.Variable = factory(root.alkali.lang)
    }
}(this, function (lang) {
	var deny = {}
	var noChange = {}
	var WeakMap = lang.WeakMap
	var setPrototypeOf = Object.setPrototypeOf || (function(base, proto) { base.__proto__ = proto})
	var getPrototypeOf = Object.getPrototypeOf || (function(base) { return base.__proto__ })
	// update types
	var ToParent = 2
	var RequestChange = 3
	var Refresh = Object.freeze({
		type: 'refresh'
	})
	var ToChild = Object.freeze({
		type: 'refresh'
	})
	var nextId = 1
	var propertyListenersMap = new WeakMap(null, 'propertyListenersMap')

	var CacheEntry = lang.compose(WeakMap, function() {
	},{
		_propertyChange: function(propertyName) {
			this.variable._propertyChange(propertyName, contextFromCache(this))
		}
	})
	var listenerId = 1

	function mergeSubject(context) {
		for (var i = 1, l = arguments.length; i < l; i++) {
			var nextContext = arguments[i]
			if (nextContext !== context && (!context || nextContext && context.contains && context.contains(nextContext))) {
				context = nextContext
			}
		}
		return context
	}

	function getDistinctContextualized(variable, context) {
		var subject = context && (context.distinctSubject || context.subject)
		if (typeof variable === 'function') {
			return variable.for(subject)
		}
		var contextMap = variable.contextMap
		if (context && contextMap) {
			while(subject && !contextMap.has(subject)) {
				subject = subject.parentNode
			}
			if (!subject) {
				subject = defaultContext
			}
			return contextMap.get(subject)
		}
	}
	function when(value, callback) {
		if (value && value.then) {
			return value.then(callback)
		}
		return callback(value)
	}

	function Context(subject){
		this.subject = subject
	}
	function whenAll(inputs, callback){
		var promiseInvolved
		var needsContext
		for (var i = 0, l = inputs.length; i < l; i++) {
			if (inputs[i] && inputs[i].then) {
				promiseInvolved = true
			}
		}
		if (promiseInvolved) {
			return lang.whenAll(inputs, callback)
		}
		return callback(inputs)
	}

	function registerListener(value, listener) {
		var listeners = propertyListenersMap.get(value)
		var id = listener.listenerId || (listener.listenerId = ('-' + listenerId++))
		if (listeners) {
			if (listeners[id] === undefined) {
				listeners[id] = listeners.push(listener) - 1
			}
		}else{
			propertyListenersMap.set(value, listeners = [listener])
			listeners[id] = 0
			if (Variable.autoObserveObjects) {
				observe(value)
			}
		}
		listener.listeningToObject = value
	}
	function deregisterListener(listener) {
		if (listener.listeningToObject) {
			var value = listener.listeningToObject
			listener.listeningToObject = null
			var listeners = propertyListenersMap.get(value)
			if (listeners) {
				var index = listeners[listener.listenerId]
				if (index > -1) {
					listeners.splice(index, 1)
					delete listeners[listener.listenerId]
				}
			}
		}
	}

	function PropertyChange(key, object, childEvent) {
		this.key = key
		this.object = object
		this.childEvent = childEvent
		this.version = nextId++
	}
	PropertyChange.prototype.type = 'update'
	function Variable(value) {
		if (this instanceof Variable) {
			// new call, may eventually use new.target
			this.value = typeof value === 'undefined' ? this.default : value
		} else {
			return Variable.extend(value)
		}
	}
	var VariablePrototype = Variable.prototype = {
		constructor: Variable,
		valueOf: function(context) {
			if (this.subject) {
				var variable = this
				context = new Context(this.subject)
			}
			return this.gotValue(this.getValue(context), context)
		},
		getValue: function() {
			return this.value
		},
		gotValue: function(value, context) {
			var previousNotifyingValue = this.notifyingValue
			var variable = this
			if (value && value.then) {
				return when(value, function(value) {
					return Variable.prototype.gotValue.call(variable, value, context)
				})
			}
			if (previousNotifyingValue) {
				if (value === previousNotifyingValue) {
					// nothing changed, immediately return valueOf
					var resolvedValue = value.valueOf()
					if (resolvedValue !== this.listeningToObject) {
						if (this.listeningToObject) {
							deregisterListener(this)
						}
						if (typeof resolvedValue === 'object' && resolvedValue && (this.dependents || this.constructor.dependents)) {
							// set up the listeners tracking
							registerListener(resolvedValue, this)
						}
					}
					return resolvedValue
				}
				// if there was a another value that we were dependent on before, stop listening to it
				// TODO: we may want to consider doing cleanup after the next rendering turn
				if (variable.dependents) {
					previousNotifyingValue.stopNotifies(variable)
				}
				variable.notifyingValue = null
			}
			if (value && value.notifies) {
				if (variable.dependents) {
						// the value is another variable, start receiving notifications
					value.notifies(variable)
				}
				variable.notifyingValue = value
				value = value.valueOf(context)
			}
			if (typeof value === 'object' && value && (this.dependents || this.constructor.dependents)) {
				// set up the listeners tracking
				registerListener(value, this)
			}
			if (value === undefined) {
				value = variable.default
			}
			return value
		},
		isMap: function() {
			return this.value instanceof Map
		},
		property: function(key) {
			var isMap = this.isMap()
			var properties = this._properties || (this._properties = isMap ? new Map() : {})
			var propertyVariable = isMap ? properties.get(key) : properties[key]
			if (!propertyVariable) {
				// create the property variable
				propertyVariable = new Property(this, key)
				if (isMap) {
					properties.set(key, propertyVariable)
				} else {
					properties[key] = propertyVariable
				}
			}
			return propertyVariable
		},
		for: function(subject) {
			if (subject && subject.target && !subject.constructor.getForClass) {
				// makes HTML events work
				subject = subject.target
			}
			if (typeof this === 'function') {
				// this is a class, the subject should hopefully have an entry
				if (subject) {
					var instance = subject.constructor.getForClass(subject, this)
					if (instance && !instance.subject) {
						instance.subject = subject
					}
					// TODO: Do we have a global context that we set on defaultInstance?
					return instance || this.defaultInstance
				} else {
					return this.defaultInstance
				}
			}
			return new ContextualizedVariable(this, subject || defaultContext)
		},
		distinctFor: function(subject) {
			if (typeof this === 'function') {
				return this.for(subject)
			}
			var map = this.contextMap || (this.contextMap = new WeakMap())
			if (map.has(subject)) {
				return map.get(subject)
			}
			var contextualizedVariable
			map.set(subject, contextualizedVariable = new ContextualizedVariable(this, subject))
			return contextualizedVariable
		},
		_propertyChange: function(propertyName, object, context, type) {
			if (this.onPropertyChange) {
				this.onPropertyChange(propertyName, object, context)
			}
			var properties = this._properties
			var property = properties && (properties instanceof Map ? properties.get(propertyName) : properties[propertyName])
			if (property && !(type instanceof PropertyChange) && object === this.valueOf(context)) {
				property.parentUpdated(ToChild, context)
			}
			this.updated(new PropertyChange(propertyName, object, type), null, context)
		},
		eachKey: function(callback) {
			for (var i in this._properties) {
				callback(i)
			}
		},
		apply: function(instance, args) {
			return new Call(this, args)
		},
		call: function(instance) {
			return this.apply(instance, Array.prototype.slice.call(arguments, 1))
		},
		forDependencies: function(callback) {
			if (this.notifyingValue) {
				callback(this.notifyingValue)
			}
		},
		init: function() {
			if (this.subject) {
				this.constructor.notifies(this)
			}
			var variable = this
			this.forDependencies(function(dependency) {
				dependency.notifies(variable)
			})
		},
		cleanup: function() {
			var handles = this.handles
			if (handles) {
				for (var i = 0; i < handles.length; i++) {
					handles[i].remove()
				}
			}
			this.handles = null
			deregisterListener(this)
			var notifyingValue = this.notifyingValue
			if (notifyingValue) {
				// TODO: move this into the caching class
				this.computedVariable = null
			}
			var variable = this
			this.forDependencies(function(dependency) {
				dependency.stopNotifies(variable)
			})
			if (this.context) {
				this.constructor.stopNotifies(this)
			}
		},

		updateVersion: function() {
			this.version = nextId++
		},

		getVersion: function(context) {
			return Math.max(this.version || 0, this.notifyingValue && this.notifyingValue.getVersion ? this.notifyingValue.getVersion(context) : 0)
		},

		getSubject: function(selectVariable) {
			return this.subject
		},

		getUpdates: function(since) {
			var updates = []
			var nextUpdateMap = this.nextUpdateMap
			if (nextUpdateMap && since) {
				while ((since = nextUpdateMap.get(since))) {
					if (since === Refresh) {
						// if it was refresh, we can clear any prior entries
						updates = []
					}
					updates.push(since)
				}
			}
			return updates
		},

		updated: function(updateEvent, by, context) {
			if (this.subject) {
				if (by === this.constructor) {
					// if we receive an update from the constructor, filter it
					if (!(!context || context.subject === this.subject || (context.subject.contains && this.subject.nodeType && context.subject.contains(this.subject)))) {
						return
					}
				} else {
					// if we receive an outside update, send it to the constructor
					return this.constructor.updated(updateEvent, this, new Context(this.subject))
				}
			}
			if (this.lastUpdate) {
				var nextUpdateMap = this.nextUpdateMap
				if (!nextUpdateMap) {
					nextUpdateMap = this.nextUpdateMap = new WeakMap()
				}
				nextUpdateMap.set(this.lastUpdate, updateEvent)
			}

			this.lastUpdate = updateEvent
			this.updateVersion()
			var value = this.value
			if (!(updateEvent instanceof PropertyChange)) {
				deregisterListener(this)
			}

			var dependents = this.dependents
			if (dependents) {
				// make a copy, in case they change
				dependents = dependents.slice(0)
				for (var i = 0, l = dependents.length; i < l; i++) {
					try{
						var dependent = dependents[i]
						// skip notifying property dependents if we are headed up the parent chain
						if (!(updateEvent instanceof PropertyChange) ||
								dependent.parent !== this || // if it is not a child property
								(by && by.constructor === this)) { // if it is coming from a child context
							if (dependent.parent === this) {
								dependent.parentUpdated(ToChild, context)
							} else {
								dependent.updated(updateEvent, this, context)
							}
						}
					}catch(e) {
						console.error(e, e.stack, 'updating a variable')
					}
				}
			}
		},

		invalidate: function() {
			// for back-compatibility for now
			this.updated()
		},

		notifies: function(target) {
			var dependents = this.dependents
			if (!dependents || !this.hasOwnProperty('dependents')) {
				this.init()
				this.dependents = dependents = []
			}
			dependents.push(target)
			var variable = this
			return {
				unsubscribe: function() {
					variable.stopNotifies(target)
				}
			}
		},
		subscribe: function(listener) {
			// ES7 Observable (and baconjs) compatible API
			var updated
			var updateQueued
			var variable = this
			// it is important to make sure you register for notifications before getting the value
			if (typeof listener === 'function') {
				// BaconJS compatible API
				var variable = this
				var event = {
					value: function() {
						return variable.valueOf()
					}
				}
				updated = function() {
					updateQueued = false
					listener(event)
				}
			}	else if (listener.next) {
				// Assuming ES7 Observable API. It is actually a streaming API, this pretty much violates all principles of reactivity, but we will support it
				updated = function() {
					updateQueued = false
					listener.next(variable.valueOf())
				}
			} else {
				throw new Error('Subscribing to an invalid listener, the listener must be a function, or have an update or next method')
			}

			var handle = this.notifies({
				updated: function() {
					if (updateQueued) {
						return
					}
					updateQueued = true
					lang.nextTurn(updated)
				}
			})
			var initialValue = this.valueOf()
			if (initialValue !== undefined) {
				updated()
			}
			return handle
		},
		stopNotifies: function(dependent) {
			var dependents = this.dependents
			if (dependents) {
				for (var i = 0; i < dependents.length; i++) {
					if (dependents[i] === dependent) {
						dependents.splice(i--, 1)
					}
				}
				if (dependents.length === 0) {
					// clear the dependents so it will be reinitialized if it has
					// dependents again
					this.dependents = dependents = false
					this.cleanup()
				}
			}
		},
		put: function(value, context) {
			var variable = this
			
			return when(this.getValue(context), function(oldValue) {
				if (oldValue === value) {
					return noChange
				}
				if (variable.fixed &&
						// if it is set to fixed, we see we can put in the current variable
						oldValue && oldValue.put && // if we currently have a variable
						// and it is always fixed, or not a new variable
						(variable.fixed == 'always' || !(value && value.notifies))) {
					return oldValue.put(value)
				}
				return when(variable.setValue(value, context), function(value) {
					variable.updated(Refresh, variable, context)
				})
			})
		},
		get: function(key) {
			return when(this.valueOf(), function(object) {
				var value = object && (typeof object.get === 'function' ? object.get(key) : object[key])
				if (value && value.notifies) {
					// nested variable situation, get underlying value
					return value.valueOf()
				}
				return value
			})
		},
		set: function(key, value) {
			// TODO: create an optimized route when the property doesn't exist yet
			this.property(key).put(value)
		},
		undefine: function(key, context) {
			this.set(key, undefined, context)
		},

		next: function(value) {
			// for ES7 observable compatibility
			this.put(value)
		},
		error: function(error) {
			// for ES7 observable compatibility
			var dependents = this.dependents
			if (dependents) {
				// make a copy, in case they change
				dependents = dependents.slice(0)
				for (var i = 0, l = dependents.length; i < l; i++) {
					try{
						var dependent = dependents[i]
						// skip notifying property dependents if we are headed up the parent chain
						dependent.error(error)
					}catch(e) {
						console.error(e, 'sending an error')
					}
				}
			}
		},
		complete: function(value) {
			// for ES7 observable compatibility
			this.put(value)
		},
		setValue: function(value) {
			this.value = value
		},
		onValue: function(listener) {
			return this.subscribe(function(event) {
				lang.when(event.value(), function(value) {
					listener(value)
				})
			})
		},
		forEach: function(callback, context) {
			// iterate through current value of variable
			return when(this.valueOf(), function(value) {
				if (value && value.forEach) {
					value.forEach(callback)
				}else{
					for (var i in value) {
						callback(value[i], i)
					}
				}
			})
		},
		each: function(callback) {
			// returns a new mapped variable
			// TODO: support events on array (using dstore api)
			return this.map(function(array) {
				return array.map(callback)
			})
		},

		map: function (operator) {
			// TODO: eventually make this act on the array items instead
			var stack = new Error().stack
			return this.to(function(value) {
				if (value && value.forEach) {
					console.warn('Variable `map()` usage with arrays is deprecated, should use `to()` instead at ', stack)
				}
				return operator(value)
			})
		},
		to: function (operator) {
			// TODO: create a more efficient map, we don't really need a full variable here
			if (!operator) {
				throw new Error('No function provided to transform')
			}
			return new Variable(operator).apply(null, [this])
		},
		get schema() {
			// default schema is the constructor
			return this.notifyingValue ? this.notifyingValue.schema : this.constructor
		},
		set schema(schema) {
			// but allow it to be overriden
			Object.defineProperty(this, 'schema', {
				value: schema
			})
		},
		validate: function(target, schema) {
			if (this.notifyingValue) {
				return this.notifyingValue.validate(target, schema)
			}
			if (schema.type && (schema.type !== typeof target)) {
				return ['Target type of ' + typeof target + ' does not match schema type of ' + schema.type]
			}
			var valid = []
			valid.isValid = true
			return valid
		},

		get validation() {
			var validation = new Validating(this)
			Object.defineProperty(this, 'validation', {
				value: validation
			})
			return validation
		},
		set validation(validation) {
			// but allow it to be overriden
			Object.defineProperty(this, 'validation', {
				value: validation
			})
		},
		getId: function() {
			return this.id || (this.id = nextId++)
		}
	}	

	if (typeof Symbol !== 'undefined') {
		Variable.prototype[Symbol.iterator] = function() {
			return this.valueOf()[Symbol.iterator]()
		}
	}

	var cacheNotFound = {}
	var Caching = Variable.Caching = lang.compose(Variable, function(getValue, setValue) {
		if (getValue) {
			this.getValue = getValue
		}
		if (setValue) {
			this.setValue = setValue
		}
	}, {
		valueOf: function(context) {
			// first check to see if we have the variable already computed
			if (this.cachedVersion === this.getVersion()) {
				if (this.contextMap) {
					var contextualizedVariable = getDistinctContextualized(this, context)
					if (contextualizedVariable) {
						return contextualizedVariable.cachedValue
					}
				} else {
					return this.cachedValue
				}
			}
			
			var variable = this

			function withComputedValue(computedValue) {
				if (computedValue && computedValue.notifies && variable.dependents) {
					variable.computedVariable = computedValue
				}
				computedValue = variable.gotValue(computedValue, watchedContext)
				var contextualizedVariable
				if (watchedContext && watchedContext.distinctSubject) {
					(variable.contextMap || (variable.contextMap = new WeakMap()))
						.set(watchedContext.distinctSubject,
							contextualizedVariable = new ContextualizedVariable(variable, watchedContext.distinctSubject))
					context.distinctSubject = mergeSubject(context.distinctSubject, watchedContext.distinctSubject)
				} else {
					contextualizedVariable = variable
				}
				contextualizedVariable.cachedVersion = newVersion
				contextualizedVariable.cachedValue = computedValue
				return computedValue
			}

			var watchedContext
			if (context) {
				watchedContext = new Context(context.subject)
			}
			var newVersion = this.getVersion()
			var computedValue = this.getValue(watchedContext)
			if (computedValue && computedValue.then) {
				return computedValue.then(withComputedValue)
			} else {
				return withComputedValue(computedValue)
			}
		}
	})

	function GetCache() {
	}

	var Property = lang.compose(Variable, function Property(parent, key) {
		this.parent = parent
		this.key = key
	},
	{
		forDependencies: function(callback) {
			Variable.prototype.forDependencies.call(this, callback)
			callback(this.parent)
		},
		valueOf: function(context) {
			var key = this.key
			var property = this
			var object = this.parent.valueOf(context)
			function gotValueAndListen(object) {
				if (property.dependents) {
					var listeners = propertyListenersMap.get(object)
					if (listeners && listeners.observer && listeners.observer.addKey) {
						listeners.observer.addKey(key)
					}
				}
				var value = property.gotValue(object == null ? undefined : typeof object.get === 'function' ? object.get(key) : object[key])
				return value
			}
			if (object && object.then) {
				return when(object, gotValueAndListen)
			}
			return gotValueAndListen(object)
		},
		put: function(value, context) {
			return this._changeValue(context, RequestChange, value)
		},
		parentUpdated: function(updateEvent, context) {
			return Variable.prototype.updated.call(this, updateEvent, this.parent, context)
		},
		updated: function(updateEvent, by, context) {
			//if (updateEvent !== ToChild) {
				this._changeValue(context, updateEvent)
			//}
			return Variable.prototype.updated.call(this, updateEvent, by, context)
		},
		_changeValue: function(context, type, newValue) {
			var key = this.key
			var parent = this.parent
			return when(parent.valueOf(context), function(object) {
				if (object == null) {
					// nothing there yet, create an object to hold the new property
					var response = parent.put(object = typeof key == 'number' ? [] : {}, context)
				}else if (typeof object != 'object') {
					// if the parent is not an object, we can't set anything (that will be retained)
					return deny
				}
				if (type == RequestChange) {
					var oldValue = typeof object.get === 'function' ? object.get(key) : object[key]
					if (oldValue === newValue) {
						// no actual change to make
						return noChange
					}
					if (typeof object.set === 'function') {
						object.set(key, newValue)
					} else {
						object[key] = newValue
					}
				}
				var listeners = propertyListenersMap.get(object)
				// at least make sure we notify the parent
				// we need to do it before the other listeners, so we can update it before
				// we trigger a full clobbering of the object
				parent._propertyChange(key, object, context, type)
				if (listeners) {
					listeners = listeners.slice(0)
					for (var i = 0, l = listeners.length; i < l; i++) {
						var listener = listeners[i]
						if (listener !== parent) {
							// now go ahead and actually trigger the other listeners (but make sure we don't do the parent again)
							listener._propertyChange(key, object, context, type)
						}
					}
				}
			})
		},
		validate: function(target, schema) {
			return this.parent.validate(target.valueOf(), schema)
		}
	})
	Object.defineProperty(Property.prototype, 'schema', {
		get: function() {
			var parentSchemaProperties = this.parent.schema.properties
			return parentSchemaProperties && parentSchemaProperties[this.key]
		},
		set: function(schema) {
			// have to repeat the override
			Object.defineProperty(this, 'schema', {
				value: schema
			})
		}
	})
	Variable.Property = Property

	var Item = Variable.Item = lang.compose(Variable, function Item(value) {
		this.value = value
	}, {})

	var Composite = Variable.Composite = lang.compose(Caching, function Composite(args) {
		this.args = args
	}, {
		forDependencies: function(callback) {
			// depend on the args
			Caching.prototype.forDependencies.call(this, callback)
			var args = this.args
			for (var i = 0, l = args.length; i < l; i++) {
				var arg = args[i]
				if (arg && arg.notifies) {
					callback(arg)
				}
			}
		},

		updated: function(updateEvent, by, context) {
			var args = this.args
			if (by !== this.notifyingValue && updateEvent !== Refresh) {
				// using a painful search instead of indexOf, because args may be an arguments object
				for (var i = 0, l = args.length; i < l; i++) {
					var arg = args[i]
					if (arg === by) {
						// if one of the args was updated, we need to do a full refresh (we can't compute differential events without knowledge of how the mapping function works)
						updateEvent = Refresh
						continue
					}
				}
			}
			Caching.prototype.updated.call(this, updateEvent, by, context)
		},

		getUpdates: function(since) {
			// this always issues updates, nothing incremental can flow through it
			if (!since || since.version < getVersion()) {
				return [new Refresh()]
			}
		},

		getVersion: function(context) {
			var args = this.args
			var version = Variable.prototype.getVersion.call(this, context)
			for (var i = 0, l = args.length; i < l; i++) {
				var arg = args[i]
				if (arg && arg.getVersion) {
					version = Math.max(version, arg.getVersion(context))
				}
			}
			return version
		},

		getValue: function(context) {
			var results = []
			var args = this.args
			for (var i = 0, l = args.length; i < l; i++) {
				var arg = args[i]
				results[i] = arg && arg.valueOf(context)
			}
			return whenAll(results, function(resolved) {
				return resolved
			})
		}
	})

	// a call variable is the result of a call
	var Call = lang.compose(Composite, function Call(functionVariable, args) {
		this.functionVariable = functionVariable
		this.args = args
	}, {
		forDependencies: function(callback) {
			// depend on the args
			Composite.prototype.forDependencies.call(this, callback)
			callback(this.functionVariable)
		},

		getValue: function(context) {
			var functionValue = this.functionVariable.valueOf(context)
			if (functionValue.then) {
				var call = this
				return functionValue.then(function(functionValue) {
					return call.invoke(functionValue, call.args, context)
				})
			}
			return this.invoke(functionValue, this.args, context)
		},

		getVersion: function(context) {
			// TODO: shortcut if we are live and since equals this.lastUpdate
			return Math.max(Composite.prototype.getVersion.call(this, context), this.functionVariable.getVersion(context))
		},

		execute: function(context) {
			var call = this
			return when(this.functionVariable.valueOf(context), function(functionValue) {
				return call.invoke(functionValue, call.args, context, true)
			})
		},

		put: function(value, context) {
			var call = this
			return when(this.valueOf(context), function(originalValue) {
				if (originalValue === value) {
					return noChange
				}
				return when(call.functionVariable.valueOf(context), function(functionValue) {
					return call.invoke(function() {
						if (functionValue.reverse) {
							functionValue.reverse.call(call, value, call.args, context)
							return Variable.prototype.put.call(call, value, context)
						}else{
							return deny
						}
					}, call.args, context)
				});				
			})
		},
		invoke: function(functionValue, args, context, observeArguments) {
			var instance = this.functionVariable.parent
			if (functionValue.handlesContext) {
				return functionValue.apply(instance, args, context)
			}else{
				var results = []
				for (var i = 0, l = args.length; i < l; i++) {
					var arg = args[i]
					results[i] = arg && arg.valueOf(context)
				}
				instance = instance && instance.valueOf(context)
				if (functionValue.handlesPromises) {
					return functionValue.apply(instance, results, context)
				}else{
					// include the instance in whenAll
					results.push(instance)
					// wait for the values to be received
					return whenAll(results, function(inputs) {
						if (observeArguments) {
							var handles = []
							for (var i = 0, l = inputs.length; i < l; i++) {
								var input = inputs[i]
								if (input && typeof input === 'object') {
									handles.push(observe(input))
								}
							}
							var instance = inputs.pop()
							try{
								var result = functionValue.apply(instance, inputs, context)
							}finally{
								when(result, function() {
									for (var i = 0; i < l; i++) {
										handles[i].done()
									}
								})
							}
							return result
						}
						var instance = inputs.pop()
						return functionValue.apply(instance, inputs, context)
					})
				}
			}
		},
		setReverse: function(reverse) {
			this.functionVariable.valueOf().reverse = reverse
			return this
		}
	})
	Variable.Call = Call

	var ContextualizedVariable = lang.compose(Variable, function ContextualizedVariable(Source, subject) {
		this.constructor = Source
		this.subject = subject
	}, {
		valueOf: function() {
			return this.constructor.valueOf(new Context(this.subject))
		},

		put: function(value) {
			return this.constructor.put(value, new Context(this.subject))
		},
		parentUpdated: function(event, context) {
			// if we receive an outside update, send it to the constructor
			this.constructor.updated(event, this.parent, this.context)
		}
	})


	function arrayMethod(name, sendUpdates) {
		Variable.prototype[name] = function() {
			var args = arguments
			var variable = this
			return when(this.cachedValue || this.valueOf(), function(array) {
				if (!array) {
					variable.put(array = [])
				}
				// try to use own method, but if not available, use Array's methods
				var result = array[name] ? array[name].apply(array, args) : Array.prototype[name].apply(array, args)
				if (sendUpdates) {
					sendUpdates.call(variable, args, result, array)
				}
				return result
			})
		}
	}
	arrayMethod('splice', function(args, result) {
		for (var i = 0; i < args[1]; i++) {
			this.updated({
				type: 'delete',
				previousIndex: args[0],
				oldValue: result[i]
			}, this)
		}
		for (i = 2, l = args.length; i < l; i++) {
			this.updated({
				type: 'add',
				value: args[i],
				index: args[0] + i - 2
			}, this)
		}
	})
	arrayMethod('push', function(args, result) {
		for (var i = 0, l = args.length; i < l; i++) {
			var arg = args[i]
			this.updated({
				type: 'add',
				index: result - i - 1,
				value: arg
			}, this)
		}
	})
	arrayMethod('unshift', function(args, result) {
		for (var i = 0, l = args.length; i < l; i++) {
			var arg = args[i]
			this.updated({
				type: 'add',
				index: i,
				value: arg
			}, this)
		}
	})
	arrayMethod('shift', function(args, results) {
		this.updated({
			type: 'delete',
			previousIndex: 0
		}, this)
	})
	arrayMethod('pop', function(args, results, array) {
		this.updated({
			type: 'delete',
			previousIndex: array.length
		}, this)
	})

	function iterateMethod(method) {
		Variable.prototype[method] = function() {
			return new IterativeMethod(this, method, arguments)
		}
	}

	iterateMethod('filter')
	//iterateMethod('map')

	var IterativeMethod = lang.compose(Composite, function(source, method, args) {
		this.source = source
		// source.interestWithin = true
		this.method = method
		this.args = args
	}, {
		getValue: function(context) {
			var method = this.method
			var args = this.args
			var variable = this
			return when(this.source.valueOf(context), function(array) {
				if (array && array.forEach) {
					if (variable.dependents) {
						var map = variable.contextMap || (variable.contextMap = new WeakMap())
						var contextualizedVariable
						if (context) {
							if (map.has(context.distinctSubject)) {
								contextualizedVariable = map.get(context.distinctSubject)
							} else {
								map.set(context.distinctSubject, contextualizedVariable = new ContextualizedVariable(variable, context.distinctSubject))
							}
						} else {
							contextualizedVariable = variable
						}
						array.forEach(function(object) {
							registerListener(object, contextualizedVariable)
						})
					}
				} else {
					if (method === 'map'){
						// fast path, and special behavior for map
						return args[0](array)
					}
					// if not an array convert to an array
					array = [array]
				}
				// apply method
				return array[method].apply(array, args)
			})
		},
		updated: function(event, by, context) {
			if (by === this || by && by.constructor === this) {
				return Composite.prototype.updated.call(this, event, by, context)
			}
			var propagatedEvent = event.type === 'refresh' ? event : // always propagate refreshes
				this[this.method + 'Updated'](event, context)
			// TODO: make sure we normalize the event structure
			if (this.dependents && event.oldValue && typeof event.value === 'object') {
				deregisterListener(this)
			}
			if (this.dependents && event.value && typeof event.value === 'object') {
				registerListener(event.value, getDistinctContextualized(this, context))
			}
			if (propagatedEvent) {
				Composite.prototype.updated.call(this, propagatedEvent, by, context)
			}
		},
		filterUpdated: function(event, context) {
			var contextualizedVariable = getDistinctContextualized(this, context)
			if (event.type === 'delete') {
				var index = contextualizedVariable.cachedValue.indexOf(event.oldValue)
				if (index > -1) {
					contextualizedVariable.splice(index, 1)
				}
			} else if (event.type === 'add') {
				if ([event.value].filter(this.args[0]).length > 0) {
					contextualizedVariable.push(event.value)
				}
			} else if (event.type === 'update') {
				var index = contextualizedVariable.cachedValue.indexOf(event.object)
				var matches = [event.object].filter(this.args[0]).length > 0
				if (index > -1) {
					if (matches) {
						return {
							type: 'updated',
							object: event.object,
							index: index
						}
					} else {
						contextualizedVariable.splice(index, 1)
					}
				}	else {
					if (matches) {
						contextualizedVariable.push(event.object)
					}
					// else nothing mactches
				}
				return
			} else {
				return event
			}
		},
		mapUpdated: function(event) {
			return {
				type: event.type,
				value: [event.value].map(this.args[0])
			}
		},
		forDependencies: function(callback) {
			// depend on the args
			Composite.prototype.forDependencies.call(this, callback)
			callback(this.source)
		},
		getVersion: function(context) {
			return Math.max(Composite.prototype.getVersion.call(this, context), this.source.getVersion(context))
		}		
	})


	var getValue
	var GeneratorVariable = Variable.GeneratorVariable = lang.compose(Variable.Composite, function ReactiveGenerator(generator){
		this.generator = generator
		this.args = []
	}, {
		getValue: getValue = function(context, resuming) {
			var lastValue
			var i
			var generatorIterator
			if (resuming) {
				// resuming from a promise
				generatorIterator = resuming.iterator
				i = resuming.i
				lastValue = resuming.value
			} else {
				// a fresh start
				i = 0
				generatorIterator = this.generator()				
			}
			
			var args = this.args
			do {
				var stepReturn = generatorIterator.next(lastValue)
				if (stepReturn.done) {
					return stepReturn.value
				}
				var nextVariable = stepReturn.value
				// compare with the arguments from the last
				// execution to see if they are the same
				if (args[i] !== nextVariable) {
					if (args[i]) {
						args[i].stopNotifies(this)
					}
					// subscribe if it is a variable
					if (nextVariable && nextVariable.notifies) {
						nextVariable.notifies(this)
						this.args[i] = nextVariable
					} else {
						this.args[i] = null
					}
				}
				i++
				lastValue = nextVariable && nextVariable.valueOf(context)
				if (lastValue && lastValue.then) {
					// if it is a promise, we will wait on it
					var variable = this
					// and return the promise so that the getValue caller can wait on this
					return lastValue.then(function(value) {
						return getValue.call(this, context, {
							i: i,
							iterator: generatorIterator,
							value: value
						})
					})
				}
			} while(true)
		}
	})

	var Validating = lang.compose(Caching, function(target) {
		this.target = target
	}, {
		forDependencies: function(callback) {
			Caching.prototype.forDependencies.call(this, callback)
			callback(this.target)
		},
		getVersion: function(context) {
			return Math.max(Variable.prototype.getVersion.call(this, context), this.target.getVersion(context))
		},
		getValue: function(context) {
			var target = this.target
			return target.validate(target, target.schema)
		}
	})

	function validate(target) {
		var schemaForObject = schema(target)
		return new Validating(target, schemaForObject)
	}
	Variable.deny = deny
	Variable.noChange = noChange
	function addFlag(name) {
		Variable[name] = function(functionValue) {
			functionValue[name] = true
		}
	}
	addFlag(Variable, 'handlesContext')
	addFlag(Variable, 'handlesPromises')

	function observe(object) {
		var listeners = propertyListenersMap.get(object)
		if (!listeners) {
			propertyListenersMap.set(object, listeners = [])
		}
		if (listeners.observerCount) {
			listeners.observerCount++
		}else{
			listeners.observerCount = 1
			var observer = listeners.observer = lang.observe(object, function(events) {
				for (var i = 0, l = listeners.length; i < l; i++) {
					var listener = listeners[i]
					for (var j = 0, el = events.length; j < el; j++) {
						var event = events[j]
						listener._propertyChange(event.name, object)
					}
				}
			})
			if (observer.addKey) {
				for (var i = 0, l = listeners.length; i < l; i++) {
					var listener = listeners[i]
					listener.eachKey(function(key) {
						observer.addKey(key)
					})
				}
			}
		}
		return {
			remove: function() {
				if (!(--listeners.observerCount)) {
					listeners.observer.remove()
				}
			},
			done: function() {
				// deliver changes
				lang.deliverChanges(observer)
				this.remove()
			}
		}
	}

	function objectUpdated(object) {
		// simply notifies any subscribers to an object, that it has changed
		var listeners = propertyListenersMap.get(object)
		if (listeners) {
			for (var i = 0, l = listeners.length; i < l; i++) {
				listeners[i]._propertyChange(null, object)
			}
		}
	}

	function all(array) {
		// This is intended to mirror Promise.all. It actually takes
		// an iterable, but for now we are just looking for array-like
		if (array.length > -1) {
			return new Composite(array)
		}
		if (arguments.length > 1) {
			// support multiple arguments as an array
			return new Composite(arguments)
		}
		if (typeof array === 'object') {
			// allow an object as a hash to be mapped
			var keyMapping = []
			var valueArray = []
			for (var key in array) {
				keyMapping.push(key)
				valueArray.push(array[key])
			}
			return new Variable(function(results) {
				var resultObject = {}
				for (var i = 0; i < results.length; i++) {
					resultObject[keyMapping[i]] = results[i]
				}
				return resultObject
			}).apply(null, valueArray)
		}
		throw new TypeError('Variable.all requires an array')
	}

	function hasOwn(Target, createForInstance) {
		var ownedClasses = this.ownedClasses || (this.ownedClasses = new WeakMap())
		// TODO: assign to super classes
		var Class = this
		ownedClasses.set(Target, createForInstance || function() { return new Target() })
		return this
	}
	function getForClass(subject, Target) {
		var createInstance = subject.constructor.ownedClasses && subject.constructor.ownedClasses.get(Target)
		if (createInstance) {
			var ownedInstances = subject.ownedInstances || (subject.ownedInstances = new WeakMap())
			var instance = ownedInstances.get(Target)
			if (!instance) {
				ownedInstances.set(Target, instance = createInstance(subject))
				instance.subject = subject
			}
			return instance
		}
	}
	function generalizeClass() {
		var prototype = this.prototype
		var prototypeNames = Object.getOwnPropertyNames(prototype)
		for(var i = 0, l = prototypeNames.length; i < l; i++) {
			var name = prototypeNames[i]
			Object.defineProperty(this, name, getGeneralizedDescriptor(Object.getOwnPropertyDescriptor(prototype, name), name, this))
		}
	}
	function getGeneralizedDescriptor(descriptor, name, Class) {
		if (typeof descriptor.value === 'function') {
			return {
				value: generalizeMethod(Class, name)
			}
		} else {
			return descriptor
		}
	}
	function generalizeMethod(Class, name) {
		// I think we can just rely on `this`, but we could use the argument:
		// function(possibleEvent) {
		// 	var target = possibleEvent && possibleEvent.target
		var method = Class[name] = function() {
			var instance = Class.for(this)
			return instance[name].apply(instance, arguments)
		}
		method.for = function(context) {
			var instance = Class.for(context)
			return function() {
				return instance[name].apply(instance, arguments)
			}
		}
		return method
	}

	var defaultContext = {
		name: 'Default context',
		description: 'This object is the default context for classes, corresponding to a singleton instance of that class',
		constructor: {
			getForClass: function(subject, Class) {
				return Class.defaultInstance
			}
		},
		contains: function() {
			return true // contains everything
		}
	}
	function instanceForContext(Class, context) {
		if (!context) {
			throw new TypeError('Accessing a generalized class without context to resolve to an instance, call for(context) (where context is an element or related variable instance) on your variable first')
		}
		var instance = context.subject.constructor.getForClass && context.subject.constructor.getForClass(context.subject, Class) || Class.defaultInstance
		context.distinctSubject = mergeSubject(context.distinctSubject, instance.subject)
		return instance
	}
	// a variable inheritance change goes through its own prototype, so classes/constructor
	// can be used as variables as well
	for (var key in VariablePrototype) {
		Object.defineProperty(Variable, key, Object.getOwnPropertyDescriptor(VariablePrototype, key))
	}
	Variable.valueOf = function(context) {
		// contextualized getValue
		return instanceForContext(this, context).valueOf()
	}
	Variable.setValue = function(value, context) {
		// contextualized setValue
		return instanceForContext(this, context).put(value)
	}
	Variable.getForClass = getForClass
	Variable.generalize = generalizeClass
	Variable.call = Function.prototype.call // restore these
	Variable.apply = Function.prototype.apply
	Variable.extend = function(properties) {
		// TODO: handle arguments
		var Base = this
		function ExtendedVariable() {
			if (this instanceof ExtendedVariable) {
				return Base.apply(this, arguments)
			} else {
				return ExtendedVariable.extend(properties)
			}
		}
		var prototype = ExtendedVariable.prototype = Object.create(this.prototype)
		ExtendedVariable.prototype.constructor = ExtendedVariable
		setPrototypeOf(ExtendedVariable, this)
		for (var key in properties) {
			var descriptor = Object.getOwnPropertyDescriptor(properties, key)
			Object.defineProperty(prototype, key, descriptor)
			Object.defineProperty(ExtendedVariable, key, getGeneralizedDescriptor(descriptor, key, ExtendedVariable))
		}
		if (properties && properties.hasOwn) {
			hasOwn.call(ExtendedVariable, properties.hasOwn)
		}
		return ExtendedVariable
	}
	Object.defineProperty(Variable, 'defaultInstance', {
		get: function() {
			return this.hasOwnProperty('_defaultInstance') ?
				this._defaultInstance : (
					this._defaultInstance = new this(),
					this._defaultInstance.subject = defaultContext,
					this._defaultInstance)
		}
	})
	Variable.hasOwn = hasOwn
	Variable.all = all
	Variable.objectUpdated = objectUpdated
	Variable.observe = observe

	return Variable
}));