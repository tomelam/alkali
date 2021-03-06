(function (root, factory) { if (typeof define === 'function' && define.amd) {
				define(['./Variable', './Updater', './util/lang'], factory)
		} else if (typeof module === 'object' && module.exports) {
				module.exports = factory(require('./util/lang'), require('./Variable'), require('./Updater'))
		} else {
				root.alkali.Element = factory(root.alkali.lang, root.alkali.Variable, root.alkali.Updater)
		}
}(this, function (Variable, Updater, lang) {
	var knownElementProperties = {};
	['textContent', 'innerHTML', 'title', 'href', 'value', 'valueAsNumber', 'role', 'render'].forEach(function(property) {
		knownElementProperties[property] = true
	})

	var SELECTOR_REGEX = /(\.|#)([-\w]+)(.+)?/
	function isGenerator(func) {
		if (typeof func === 'function') {
			var constructor = func.constructor
			return (constructor.displayName || constructor.name) === 'GeneratorFunction'
		}
	}
	function Context(subject){
		this.subject = subject
	}

	var PropertyUpdater = Updater.PropertyUpdater
	var AttributeUpdater = Updater.AttributeUpdater
	var StyleUpdater = lang.compose(Updater.StyleUpdater, function StyleUpdater() {
		Updater.StyleUpdater.apply(this, arguments)
	}, {
		renderUpdate: function(newValue, element) {
			var definition = styleDefinitions[this.name]
			if (definition) {
				definition(element, newValue, this.name)
			} else {
				element.style[this.name] = newValue
			}
		}
	})

	var ClassNameUpdater = lang.compose(Updater.ElementUpdater, function ClassNameUpdater(options) {
		this.className = options.className
		Updater.apply(this, arguments)
	}, {
		renderUpdate: function(newValue, element) {
			var currentClassName = element.className
			var changingClassName = this.className
			// remove the className (needed for addition or removal)
			// see http://jsperf.com/remove-class-name-algorithm/2 for some tests on this
			var removed = currentClassName && (' ' + currentClassName + ' ').replace(' ' + changingClassName + ' ', ' ')
			if (newValue) {
				// addition, add the className
				changingClassName = currentClassName ? (removed + changingClassName).slice(1) : value;
			} else {
				// we already have removed the class, just need to trim
				changingClassName = removed.slice(1, removed.length - 1)
			}
			// only assign if it changed, this can save a lot of time
			if (changingClassName != currentClassName) {
				element.className = changingClassName
			}
		}
	})

	// TODO: check for renderContent with text updater
	var TextUpdater = Updater.TextUpdater
	var ListUpdater = Updater.ListUpdater
	
	var toAddToElementPrototypes = []
	var createdBaseElements = []
	var testStyle = document.createElement('div').style
	var childTagForParent = {
		TABLE: ['tr','td'],
		TBODY: ['tr','td'],
		TR: 'td',
		UL: 'li',
		OL: 'li',
		SELECT: 'option'
	}
	var inputs = {
		INPUT: 1,
		TEXTAREA: 1
		// SELECT: 1, we exclude this, so the default "content" of the element can be the options
	}

	function booleanStyle(options) {
		return function(element, value, key) {
			if (typeof value === 'boolean') {
				// has a boolean conversion
				value = options[value ? 0 : 1]
			}
			element.style[key] = value
		}
	}

	function defaultStyle(element, value, key) {
		if (typeof value === 'number') {
			value = value + 'px'
		}
		element.style[key] = value
	}
	function directStyle(element, value, key) {
		element.style[key] = value
	}

	var styleDefinitions = {
		display: booleanStyle(['initial', 'none']),
		visibility: booleanStyle(['visible', 'hidden']),
		color: directStyle,
		opacity: directStyle,
		zoom: directStyle,
		minZoom: directStyle,
		maxZoom: directStyle,
		position: booleanStyle(['absolute', '']),
		textDecoration: booleanStyle(['underline', '']),
		fontWeight: booleanStyle(['bold', 'normal'])
	}
	;["alignContent","alignItems","alignSelf","animation","animationDelay","animationDirection","animationDuration","animationFillMode","animationIterationCount","animationName","animationPlayState","animationTimingFunction","backfaceVisibility","background","backgroundAttachment","backgroundBlendMode","backgroundClip","backgroundColor","backgroundImage","backgroundOrigin","backgroundPosition","backgroundPositionX","backgroundPositionY","backgroundRepeat","backgroundRepeatX","backgroundRepeatY","backgroundSize","baselineShift","border","borderBottom","borderBottomColor","borderBottomLeftRadius","borderBottomRightRadius","borderBottomStyle","borderBottomWidth","borderCollapse","borderColor","borderImage","borderImageOutset","borderImageRepeat","borderImageSlice","borderImageSource","borderImageWidth","borderLeft","borderLeftColor","borderLeftStyle","borderLeftWidth","borderRadius","borderRight","borderRightColor","borderRightStyle","borderRightWidth","borderSpacing","borderStyle","borderTop","borderTopColor","borderTopLeftRadius","borderTopRightRadius","borderTopStyle","borderTopWidth","borderWidth","bottom","boxShadow","boxSizing","bufferedRendering","captionSide","clear","clip","clipPath","clipRule","color","colorInterpolation","colorInterpolationFilters","colorRendering","counterIncrement","counterReset","cursor","direction","display","emptyCells","fill","fillOpacity","fillRule","filter","flex","flexBasis","flexDirection","flexFlow","flexGrow","flexShrink","flexWrap","float","floodColor","floodOpacity","font","fontFamily","fontFeatureSettings","fontKerning","fontSize","fontStretch","fontStyle","fontVariant","fontVariantLigatures","fontWeight","height","imageRendering","isolation","justifyContent","left","letterSpacing","lightingColor","lineHeight","listStyle","listStyleImage","listStylePosition","listStyleType","margin","marginBottom","marginLeft","marginRight","marginTop","marker","markerEnd","markerMid","markerStart","mask","maskType","maxHeight","maxWidth","maxZoom","minHeight","minWidth","minZoom","mixBlendMode","motion","motionOffset","motionPath","motionRotation","objectFit","objectPosition","opacity","order","orientation","orphans","outline","outlineColor","outlineOffset","outlineStyle","outlineWidth","overflow","overflowWrap","overflowX","overflowY","padding","paddingBottom","paddingLeft","paddingRight","paddingTop","page","pageBreakAfter","pageBreakBefore","pageBreakInside","paintOrder","perspective","perspectiveOrigin","pointerEvents","position","quotes","resize","right","shapeImageThreshold","shapeMargin","shapeOutside","shapeRendering","size","speak","src","stopColor","stopOpacity","stroke","strokeDasharray","strokeDashoffset","strokeLinecap","strokeLinejoin","strokeMiterlimit","strokeOpacity","strokeWidth","tabSize","tableLayout","textAlign","textAlignLast","textAnchor","textCombineUpright","textDecoration","textIndent","textOrientation","textOverflow","textRendering","textShadow","textTransform","top","touchAction","transform","transformOrigin","transformStyle","transition","transitionDelay","transitionDuration","transitionProperty","transitionTimingFunction","unicodeBidi","unicodeRange","userZoom","vectorEffect","verticalAlign","visibility","whiteSpace","widows","width","willChange","wordBreak","wordSpacing","wordWrap","writingMode","zIndex","zoom"].forEach(function(property) {
		styleDefinitions[property] = styleDefinitions[property] || defaultStyle
	})
	var doc = document
	var styleSheet
	var presumptiveParentMap = new WeakMap()

	var setPrototypeOf = Object.setPrototypeOf || (function(base, proto) { base.__proto__ = proto})
	var getPrototypeOf = Object.getPrototypeOf || (function(base) { return base.__proto__ })
	function createCssRule(selector) {
		if (!styleSheet) {
			var styleSheetElement = document.createElement("style")
			styleSheetElement.setAttribute("type", "text/css")
//			styleSheet.appendChild(document.createTextNode(css))
			document.head.insertBefore(styleSheetElement, document.head.firstChild)
			styleSheet = styleSheetElement.sheet
		}
		var cssRules = styleSheet.cssRules || styleSheet.rules
		return cssRules[styleSheet.addRule(selector, ' ', cssRules.length)]
	}
	var invalidatedElements = new WeakMap(null, 'invalidated')
	var queued

	var toRender = []
	function flatten(target, part) {
		var base = target.base
		if (base) {
			var basePart = base[part]
			if (basePart) {
				target[part] || target[part]
			}
		}
	}

	function layoutChildren(parent, children, container, prepend) {
		var fragment = (children.length > 3 || prepend) ? document.createDocumentFragment() : parent
		for(var i = 0, l = children.length; i < l; i++) {
			var child = children[i]
			var childNode
			if (child && child.create) {
				// an element constructor
				currentParent = parent
				childNode = child.create()
				fragment.appendChild(childNode)
				if (child.isContentNode) {
					container.contentNode = childNode
				}
			} else if (typeof child == 'function') {
				// TODO: reenable this
//				if (child.for) {
					// a variable constructor that can be contextualized
	//				fragment.appendChild(variableAsText(parent, child))
		//		} else {
					// an element constructor
					childNode = new child()
					fragment.appendChild(childNode)
			//	}
			} else if (typeof child == 'object') {
				if (child instanceof Array) {
					// array of sub-children
					container = container || parent
					childNode = childNode || parent
					layoutChildren(childNode.contentNode || childNode, child, container)
				} else if (child.notifies) {
					// a variable
					fragment.appendChild(variableAsText(parent, child))
				} else if (child.nodeType) {
					// an element itself
					fragment.appendChild(child)
				} else {
					// TODO: apply properties to last child, but with binding to the parent (for events)
					throw new Error('Unknown child type ' + child)
				}
			} else {
				// a primitive value
				childNode = document.createTextNode(child)
				fragment.appendChild(childNode)
			}
		}
		if (fragment != parent) {
			if (prepend) {
				parent.insertBefore(fragment, parent.firstChild)
			} else {
				parent.appendChild(fragment)
			}
		}
		return childNode
	}
	function variableAsText(parent, content) {
		if (content == null) {
			return document.createTextNode('')
		}
		var text
		try {
			text = content.valueOf(new Context(parent))
		} catch (error) {
			text = error.stack
		}
		var textNode = document.createTextNode(text)
		if (content.notifies) {
			enterUpdater(TextUpdater, {
				element: parent,
				textNode: textNode,
				variable: content
			})
		}
		return textNode
	}

	function bidirectionalHandler(element, value, key) {
		if (value && value.notifies) {
			enterUpdater(PropertyUpdater, {
				name: key,
				variable: value,
				element: element
			})
			bindChanges(element, value, key)
		} else {
			element[key] = value
		}
	}

	function noop() {}
	var propertyHandlers = {
		content: noop, // content and children have special handling in create
		children: noop,
		each: noop, // just used by content, doesn't need to be recorded on the element
		classes: function(element, classes) {
			if (!(classes.length > -1)) {
				// index the classes, if necessary
				var i = 0
				for (var key in classes) {
					if (!classes[i]) {
						classes[i] = key
					}
					i++
				}
				classes.length = i
			}
			for (var i = 0, l = classes.length; i < l; i++) {
				// find each class name
				var className = classes[i]
				var flag = classes[className]
				if (flag && flag.notifies) {
					// if it is a variable, we react to it
					enterUpdater(ClassNameUpdater, {
						element: element,
						className: className,
						variable: flag
					})
				} else if (flag || flag === undefined) {
					element.className += ' ' + className
				}
			}
		},
		class: applyAttribute,
		for: applyAttribute,
		role: applyAttribute,
		render: function(element, value, key) {
			// TODO: This doesn't need to be a property updater
			// we should also verify it is a generator
			// and maybe, at some point, find an optimization to eliminate the bind()
			enterUpdater(PropertyUpdater, {
				name: key,
				variable: new Variable.GeneratorVariable(value.bind(element)),
				element: element
			})
		},
		value: bidirectionalHandler,
		valueAsNumber: bidirectionalHandler,
		valueAsDate: bidirectionalHandler,
		checked: bidirectionalHandler,
		dataset: applySubProperties(function(newValue, element, key) {
			element.dataset[key || this.name] = newValue
		}),
		attributes: applySubProperties(function(newValue, element, key) {
			element.setAttribute(key || this.name, newValue)
		}),
		style: function(element, value, key) {
			if (typeof value === 'string') {
				element.setAttribute('style', value)
			} else if (value && value.notifies) {
				enterUpdater(AttributeUpdater, {
					name: 'style',
					variable: value,
					elment: element
				})
			} else {
				styleObjectHandler(element, value, key)
			}
		}
	}
	function applyAttribute(element, value, key) {
		if (value && value.notifies) {
			enterUpdater(AttributeUpdater, {
				name: key,
				variable: value,
				element: element
			})
		} else {
			element.setAttribute(key, value)
		}
	}

	var styleObjectHandler = applySubProperties(function(newValue, element, key) {
		element.style[key || this.name] = newValue
	})

	function applySubProperties(renderer) {
		var SubPropertyUpdater = lang.compose(PropertyUpdater, function SubPropertyUpdater(options) {
			PropertyUpdater.apply(this, arguments)
		}, {
			renderUpdate: renderer
		})	
		return function(element, value, key) {
			var target = element[key]
			for (var subKey in value) {
				var subValue = value[subKey]
				if (subValue && subValue.notifies) {
					enterUpdater(SubPropertyUpdater, {
						name: subKey,
						variable: subValue,
						element: element
					})
				} else {
					renderer(subValue, element, subKey)
				}
			}
		}
	}

	function applyProperties(element, properties) {
		for (var key in properties) {
			var value = properties[key]
			var styleDefinition = styleDefinitions[key]
			if (propertyHandlers[key]) {
				propertyHandlers[key](element, value, key, properties)
			} else if ((styleDefinition = styleDefinitions[key]) && element[key] === undefined) {
				if (value && value.notifies) {
					enterUpdater(StyleUpdater, {
						name: key,
						variable: value,
						element: element
					})
				} else {
					styleDefinition(element, value, key)
				}
			} else if (value && value.notifies) {
				enterUpdater(PropertyUpdater, {
					name: key,
					variable: value,
					element: element
				})
			} else if (typeof value === 'function' && key.slice(0, 2) === 'on') {
				element.addEventListener(key.slice(2), value)
			} else {
				element[key] = value
			}
		}
	}

	function applySelector(element, selector) {
		selector.replace(/(\.|#)?(\w+)/g, function(t, operator, name) {
			if (operator == '.') {
				element._class = (element._class ? element._class + ' ' : '') + name
			} else if (operator == '#') {
				element._id = name
			} else {
				element._tag = name
			}
		})
	}

	nextClassId = 1
	uniqueSelectors = {}
	function getUniqueSelector(element) {
		var selector = element.hasOwnProperty('_uniqueSelector') ? element._uniqueSelector :
			(element._tag + (element._class ? '.' + element._class.replace(/\s+/g, '.') : '') +
			(element._id ? '#' + element._id : ''))
		if (!selector.match(/[#\.-]/)) {
			if (uniqueSelectors[selector]) {
				element._class = '.x-' + nextClassId++
				selector = getUniqueSelector(element)
			} else {
				uniqueSelectors[selector] = selector
			}
		}
		return selector
	}

	function buildContent(element, content, key, properties) {
		var each = element.each || properties.each
		if (each && content) {
			// render as list
			if (each.create) {
				var ItemClass = element.itemAs || Item
				hasOwn(each, ItemClass, function (element) {
					return new ItemClass(element._item, content)
				})
			}
			if (content.notifies) {
				enterUpdater(ListUpdater, {
					each: each,
					variable: content,
					element: element
				})
			} else {
				var fragment = document.createDocumentFragment()
				content.forEach(function(item) {
					if (each.create) {
						childElement = each.create({parent: element, _item: item}) // TODO: make a faster object here potentially
					} else {
						childElement = each(item, element)
					}
					fragment.appendChild(childElement)
				})
				element.appendChild(fragment)
			}
		} else if (inputs[element.tagName]) {
			// render into input
			buildInputContent(element, content)
		} else if (content instanceof Array) {
			// treat array as children (potentially of the content node)
			element = element.contentNode || element
			layoutChildren(element, content, element)
		} else {
			// render as string
			element.appendChild(variableAsText(element, content))
		}
	}

	function bindChanges(element, variable, key, conversion) {
		lang.nextTurn(function() { // wait for next turn in case inputChanges isn't set yet
			var inputEvents = element.inputEvents || ['change']
			for (var i = 0, l = inputEvents.length; i < l; i++) {
				element.addEventListener(inputEvents[i], function (event) {
					var value = element[key]
					var result = variable.put(conversion ? conversion(value, element) : value, new Context(element))
				})
			}
		})
	}

	function conversion(value, element) {
		if (element.type == 'number') {
			return parseFloat(value)
		}
		return value
	}

	function buildInputContent(element, content) {
		var inputType = element.type
		var inputProperty = inputType in {date: 1, datetime: 1, time: 1} ?
				'valueAsDate' : inputType === 'checkbox' ?
					'checked' : 'value'

		if (content && content.notifies) {
			// a variable, respond to changes
			enterUpdater(PropertyUpdater, {
				variable: content,
				name: inputProperty,
				element: element
			})
			// and bind the other way as well, updating the variable in response to input changes
			bindChanges(element, content, inputProperty, conversion)
		} else {
			// primitive
			element[inputProperty] = content
		}
	}
	var classHandlers = {
		hasOwn: function(Element, value) {
			hasOwn(Element, value)
		}
	}

	function applyToClass(value, Element) {
		var applyOnCreate = Element._applyOnCreate
		var prototype = Element.prototype
		if (value && typeof value === 'object') {
			if (value instanceof Array || value.notifies) {
				applyOnCreate.content = value
			} else {
				for (var key in value) {
				// TODO: eventually we want to be able to set these as rules statically per element
				/*if (styleDefinitions[key]) {
					var styles = Element.styles || (Element.styles = [])
					styles.push(key)
					styles[key] = descriptor.value
				} else {*/
					if (classHandlers[key]) {
						hasOwn(Element, value[key])
					} else {
						// TODO: do deep merging of styles and classes, but not variables
						applyOnCreate[key] = value[key]
					}
				}
			}
		} else if (typeof value === 'function' && !value.for) {
			throw new TypeError('Function as argument not supported')
		} else {
			applyOnCreate.content = value
		}
	}

	function getApplySet(Class) {
		if (Class.hasOwnProperty('_applyOnCreate')) {
			return Class._applyOnCreate
		}
		// this means we didn't extend and evaluate the prototype yet
		if (Class.getForClass) {
			// we are extending an alkali constructor
			// if this class is inheriting from an alkali constructor, work our way up the chain
			applyOnCreate = Class._applyOnCreate = {}
			var parentApplySet = getApplySet(getPrototypeOf(Class))
			for (var key in parentApplySet) {
				applyOnCreate[key] = parentApplySet[key]
			}
			// we need to check the prototype for event handlers
			var prototype = Class.prototype
			var keys = Object.getOwnPropertyNames(prototype)
			for (var i = 0, l = keys.length; i < l; i++) {
				var key = keys[i]
				if (key.slice(0, 2) === 'on' || (key === 'render' && isGenerator(prototype[key]))) {
					applyOnCreate[key] = prototype[key]
				} else if (key.slice(0, 6) === 'render') {
					Object.defineProperty(prototype, key[6].toLowerCase() + key.slice(7), renderDescriptor(key))
				}
			}
			return applyOnCreate
		}
		return null
	}

	function renderDescriptor(renderMethod) {
		var map = new WeakMap()
		return {
			get: function() {
				return map.has(this) ? map.get(this) : null
			},
			set: function(value) {
				map.set(this, value)
				this[renderMethod](value)
			}
		}
	}

	function makeElementConstructor() {
		function Element(selector, properties) {
			if (this instanceof Element){
				// create DOM element
				// Need to detect if we have registered the element and `this` is actually already the correct instance
				return create.apply(Element.prototype === getPrototypeOf(this) ? Element :// this means it is from this constructor
					this.constructor, // this means it was constructed from a subclass
					arguments)
			} else {
				// extend to create new class
				return withProperties.apply(Element, arguments)
			}
		}
		Element.create = create
		Element.with = withProperties
		Element.for = forTarget
		Element.property = propertyForElement
		Element.getForClass = getForClass
		return Element
	}

	function withProperties(selector, properties) {
		var Element = makeElementConstructor()
		Element.superConstructor = this
		if (this.children) {
			// just copy this property
			Element.children = this.children
		}
		var prototype = Element.prototype = this.prototype

		var hasOwnApplySet
		var applyOnCreate = Element._applyOnCreate = {}
		var parentApplySet = getApplySet(this)
		// copy parent properties
		for (var key in parentApplySet) {
			applyOnCreate[key] = parentApplySet[key]
		}

		var i = 0 // for arguments
		if (typeof selector === 'string') {
			var selectorMatch = selector.match(SELECTOR_REGEX)
			if (selectorMatch) {
				do {
					var operator = selectorMatch[1]
					var name = selectorMatch[2]
					if (operator == '.') {
						if (applyOnCreate.className) {
							applyOnCreate.className += ' ' + name
						} else {
							applyOnCreate.className = name
						}
					} else {
						applyOnCreate.id = name
					}
					var remaining = selectorMatch[3]
					selectorMatch = remaining && remaining.match(SELECTOR_REGEX)
				} while (selectorMatch)
			} else {
				applyOnCreate.content = selector
			}
			i++ // skip the first argument
		}

		for (var l = arguments.length; i < l; i++) {
			applyToClass(arguments[i], Element)
		}
		return Element
	}
	var currentParent
	function create(selector, properties) {
		// TODO: make this a symbol
		var applyOnCreate = getApplySet(this)
		if (currentParent) {
			var parent = currentParent
			currentParent = null
		}
/*		if (this._initialized != this) {
			this._initialized = this
			this.initialize && this.initialize()
			var styles = this.styles
			if (styles) {
				var rule = createCssRule(getUniqueSelector(this))
				for (var i = 0, l = styles.length; i < l; i++) {
					var key = styles[i]
					var value = styles[key]
					// TODO: if it is a contextualized variable, do this on the element
					var styleDefinition = styleDefinitions[key]
					if (styleDefinition) {
						styleDefinition(rule, value, key)
					}
				}
			}
			if (!this.hasOwnProperty('_applyOnCreate')) {
				applyOnCreate = getApplySet(this)
			}
		}*/
		var element = document.createElement(applyOnCreate.tagName)
		if (selector && selector.parent) {
			parent = selector.parent
		}
		if (parent) {
			presumptiveParentMap.set(element, parent)
		}
		if (!(element instanceof this)) {
			// ideally we want to avoid this call, as it is expensive, but for classes that
			// don't register a tag name, we have to make sure the prototype chain is correct
			setPrototypeOf(element, this.prototype)
		}
		if (element.constructor != this) {
			element.constructor = this // need to do this for hasOwn contextualization to work
		}
		if (arguments.length > 0) {
			// copy applyOnCreate when we have arguments
			var ElementApplyOnCreate = applyOnCreate
			applyOnCreate = {}
			for (var key in ElementApplyOnCreate) {
				applyOnCreate[key] = ElementApplyOnCreate[key]
			}
			var i = 0
			if (typeof selector == 'string') {
				i++
				var selectorMatch = selector.match(SELECTOR_REGEX)
				if (selectorMatch) {
					do {
						var operator = selectorMatch[1]
						var name = selectorMatch[2]
						if (operator == '.') {
							if (applyOnCreate.className) {
								applyOnCreate.className += ' ' + name
							} else {
								if (element.className) {
								    element.className += ' ' + name
								} else {
								    element.className = name
								}
							}
						} else {
							if (applyOnCreate.id) {
								applyOnCreate.id = name
							} else {
								// just skip right to the element
								element.id = name
							}
						}
						var remaining = selectorMatch[3]
						selectorMatch = remaining && remaining.match(SELECTOR_REGEX)
					} while (selectorMatch)
				} else {
					applyOnCreate.content = selector
				}
			} else if (selector && selector._item) {
				// this is kind of hack, to get the Item available before the properties, eventually we may want to
				// order static properties before variable binding applications, but for now.
				element._item = selector._item
			}
			for (var l = arguments.length; i < l; i++) {
				var argument = arguments[i]
				if (argument instanceof Array || argument.notifies) {
					applyOnCreate.content = argument
				} else if (typeof argument === 'function' && argument.for) {
					applyOnCreate.content = argument.for(element)
				} else {
					for (var key in argument) {
						// TODO: do deep merging of styles and classes, but not variables
						applyOnCreate[key] = argument[key]
					}
				}
			}
		}
		// TODO: inline this
		applyProperties(element, applyOnCreate)
		if (this.children) {
			layoutChildren(element, this.children, element)
		}
		// always do this last, so it can be properly inserted inside the children
		if (applyOnCreate.content) {
			buildContent(element, applyOnCreate.content, 'content', applyOnCreate)
		}
		element.createdCallback && element.createdCallback()
		element.created && element.created(applyOnCreate)
		return element
	}

	var slice = [].slice
	function append(parent){
		return this.nodeType ?
			layoutChildren(this, arguments, this) : // called as a method
			layoutChildren(parent, slice.call(arguments, 1), parent) // called as a function
	}

	function prepend(parent){
		return this.nodeType ?
			layoutChildren(this, arguments, this, true) : // called as a method
			layoutChildren(parent, slice.call(arguments, 1), parent, true) // called as a function
	}

	function registerTag(tagName) {
		getApplySet(this).tagName = tagName
		if (document.registerElement) {
			document.registerElement(tagName, this)
		}
	}

	var Element = withProperties.call(HTMLElement)

	Element.within = function(element){
		// find closest child
	}

	generate([
		'Video',
		'Source',
		'Media',
		'Audio',
		'UL',
		'Track',
		'Title',
		'TextArea',
		'Template',
		'TBody',
		'THead',
		'TFoot',
		'TR',
		'Table',
		'Col',
		'ColGroup',
		'TH',
		'TD',
		'Caption',
		'Style',
		'Span',
		'Shadow',
		'Select',
		'Script',
		'Quote',
		'Progress',
		'Pre',
		'Picture',
		'Param',
		'P',
		'Output',
		'Option',
		'Optgroup',
		'Object',
		'OL',
		'Ins',
		'Del',
		'Meter',
		'Meta',
		'Menu',
		'Map',
		'Link',
		'Legend',
		'Label',
		'LI',
		'KeyGen',
		'Input',
		'Image',
		'IFrame',
		'H1',
		'H2',
		'H3',
		'H4',
		'H5',
		'H6',
		'Hr',
		'FrameSet',
		'Frame',
		'Form',
		'Font',
		'Embed',
		'Article',
		'Aside',
		'Footer',
		'Figure',
		'FigCaption',
		'Header',
		'Main',
		'Mark',
		'MenuItem',
		'Nav',
		'Section',
		'Summary',
		'WBr',
		'Div',
		'Dialog',
		'Details',
		'DataList',
		'DL',
		'Canvas',
		'Button',
		'Base',
		'Br',
		'Area',
		'A'
	])
	generateInputs([
		'Checkbox',
		'Password',
		'Submit',
		'Radio',
		'Color',
		'Date',
		'DateTime',
		'Email',
		'Month',
		'Number',
		'Range',
		'Search',
		'Tel',
		'Time',
		'Url',
		'Week'])

	var tags = {}
	function getConstructor(tagName) {
		tagName = tagName.toLowerCase()
		return tags[tagName] ||
			(tags[tagName] =
				setTag(withProperties.call(document.createElement(tagName).constructor), tagName))
	}

	function setTag(Element, tagName) {
		Element._applyOnCreate.tagName = tagName
		return Element
	}
	function generate(elements) {
		elements.forEach(function(elementName) {
			var ElementClass
			Object.defineProperty(Element, elementName, {
				get: function() {
					return ElementClass || (ElementClass = getConstructor(elementName))
				}
			})
		})
	}
	function generateInputs(elements) {
		elements.forEach(function(inputType) {
			var ElementClass
			Object.defineProperty(Element, inputType, {
				get: function() {
					// TODO: make all inputs extend from input generated from generate
					return ElementClass || (ElementClass = setTag(withProperties.call(HTMLInputElement, {
						type: inputType.toLowerCase()
					}), 'input'))
				}
			})
			// alias all the inputs with an Input suffix
			Object.defineProperty(Element, inputType + 'Input', {
				get: function() {
					return this[inputType]
				}
			})
		})
	}

	var aliases = {
		Anchor: 'A',
		Paragraph: 'P',
		Textarea: 'TextArea',
		DList: 'DL',
		UList: 'UL',
		OList: 'OL',
		ListItem: 'LI',
		Text: 'Input',
		TextInput: 'Input',
		TableRow: 'TR',
		TableCell: 'TD',
		TableHeaderCell: 'TH',
		TableHeader: 'THead',
		TableBody: 'TBody'
	}
	for (var alias in aliases) {
		(function(alias, to) {
			Object.defineProperty(Element, alias, {
				get: function() {
					return this[to]
				}
			})			
		})(alias, aliases[alias])
	}

	Element.append = append
	Element.prepend = prepend
	Element.refresh = Updater.refresh
	var options = Element.options = {
		moveLiveElementsEnabled: true,
	}
	Element.content = function(element){
		// container marker
		return {
			isContentNode: true,
			create: element.create.bind(element)
		}
	}
	// TODO: unify this in lang
	Element.extend = function(Class, properties) {
		function ExtendedElement() {
			return Class.apply(this, arguments)
		}
		setPrototypeOf(ExtendedElement, Class)
		var prototype = ExtendedElement.prototype = Object.create(Class.prototype)
		prototype.constructor = ExtendedElement
		Object.getOwnPropertyNames(properties).forEach(function(key) {
			var descriptor = Object.getOwnPropertyDescriptor(properties, key)
			if (classHandlers[key]) {
				classHandlers[key](ExtendedElement, descriptor.value)
			} else {
				Object.defineProperty(prototype, key, descriptor)
			}
		})
		return ExtendedElement
	}

	function forTarget(target) {
		return target.constructor.getForClass(target, this)
	}

	function hasOwn(From, Target, createInstance) {
		if (typeof Target === 'object' && Target.Class) {
			return hasOwn(From, Target.Class, Target.createInstance)
		}
		if (Target instanceof Array) {
			return Target.forEach(function(Target) {
				hasOwn(From, Target)
			})
		}
		var ownedClasses = From.ownedClasses || (From.ownedClasses = new WeakMap())
		// TODO: assign to super classes
		ownedClasses.set(Target, createInstance || function() {
			return new Target()
		})
		return From
	}

	var globalInstances = {}
	function getForClass(element, Target) {
		var createInstance
		while (element && !(createInstance = element.constructor.ownedClasses && element.constructor.ownedClasses.get(Target))) {
			element = element.parentNode || presumptiveParentMap.get(element)
		}
		if (createInstance) {
			var ownedInstances = element.ownedInstances || (element.ownedInstances = new WeakMap())
			var instance = ownedInstances.get(Target)
			if (instance === undefined) {
				ownedInstances.set(Target, instance = createInstance(element))
				instance.subject = element
			}
			return instance
		}
	}

	function propertyForElement(key) {
		// we just need to establish one Variable class for each element, so we cache it
		ThisElementVariable = this._Variable
		if (!ThisElementVariable) {
			// need our own branded variable class for this element class
			ThisElementVariable = this._Variable = Variable()

			hasOwn(this, ThisElementVariable, function(element) {
				// when we create the instance, immediately observe it
				// TODO: we might want to do this in init instead
				var instance = new ThisElementVariable(element)
				Variable.observe(element)
				return instance
			})
		}
		// now actually get the property class
		return ThisElementVariable.property(key)
	}

	var Item = Element.Item = Variable.Item

	function enterUpdater(Updater, options/*, target*/) {
		// this will be used for optimized class-level variables
		/*if (target.started) { // TODO: Might want to pass in started as a parameter
			// this means that the updater has already been created, so we just need to add this instance
			Updater.prototype.renderUpdate.call(options, element)
		} else {*/
		var target = options.element
		var updaters = target.updaters || (target.updaters = [])
		updaters.push(new Updater(options))
		//}
	}

	function cleanup(target) {
		var updaters = target.updaters
		if (updaters) {
			for (var i = 0, l = updaters.length; i < l; i++) {
				updaters[i].stop()
			}
			target.needsRestart = true
		}
	}
	function restart(target) {
		var updaters = target.updaters
		if (updaters) {
			for (var i = 0, l = updaters.length; i < l; i++) {
//				updaters[i].start()
			}
		}
	}
	// setup the mutation observer so we can be notified of attachments and removals
	function elementAttached(element) {
		var Class = element.constructor
		if (Class.create) {
/*			if (Class.attachedInstances) {
				Class.attachedInstances.push(element)
				if (Class.attachedInstances.length === 1 && Class.needsRestart) {
					restart(Class)
				}
			} else {
				Class.attachedInstances = [element]
			}*/
			if (element.attached) {
				element.attached()
			}
			if (element.needsRestart) {
				restart(element)
			}
		}
	}
	function elementDetached(element) {
		/*var attachedInstances = element.constructor.attachedInstances
		if (attachedInstances) {
			var index = attachedInstances.indexOf(element)
			if (index > -1) {
				attachedInstances.splice(index, 1)
				if (attachedInstances.length === 0) {
					cleanup(Class)
				}
			}*/
			if (element.detached) {
				element.detached()
			}
			cleanup(element)
		//}
	}
	if (typeof MutationObserver === 'function') {
		var lifeStates = [{
			name: 'detached',
			nodes: 'removedNodes',
			action: elementDetached
		}, {
			name: 'attached',
			nodes: 'addedNodes',
			action: elementAttached
		}]
		function firstVisit(node, state) {
			if (state.name === 'attached') {
				if (node.__alkaliAttached__) {
					return false
				} else {
					node.__alkaliAttached__ = true
					state.action(node)
					return true
				}
			} else if (node.__alkaliAttached__) {
				node.__alkaliAttached__ = false
				state.action(node)
			}
			return true
		}
		var observer = new MutationObserver(function(mutations) {
			for (var i = 0, il = mutations.length; i < il; i++) {
				var mutation = mutations[i]
				// invoke action on element if we haven't already
				actionIteration:
				for (var j = 0, jl = lifeStates.length; j < jl; j++) { // two steps, removed nodes and added nodes
					var state = lifeStates[j]
					var nodes = mutation[state.nodes]
					// iterate over node list
					nodeIteration:
					for (var k = 0, kl = nodes.length; k < kl; k++) {
						var baseNode = nodes[k]
						if (firstVisit(baseNode, state)) {
							// start traversal with child, if it exists
							var currentNode = baseNode.firstChild
							if (currentNode) {
								do {
									var nextNode
									if (currentNode.nodeType === 1 && firstVisit(currentNode, state)) {
										// depth-first search
										nextNode = currentNode.firstChild
										if (!nextNode) {
											nextNode = currentNode.nextSibling
										}
									} else {
										nextNode = currentNode.nextSibling
									}
									if (!nextNode) {
										// come back out to parents
										// TODO: try keeping a stack to make this faster
										do {
											currentNode = currentNode.parentNode
											if (currentNode === baseNode) {
												continue nodeIteration
											}
										} while (!(nextNode = currentNode.nextSibling))
									}
									currentNode = nextNode
								} while (true)
							}
						}
					}
					// if (options.moveLiveElementsEnabled) {
						// TODO: any options that we can really do here?
				}
			}
		})
		observer.observe(document.body, {
			childList: true,
			subtree: true
		})
	}

	return Element
}))
