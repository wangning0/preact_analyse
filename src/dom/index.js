import { IS_NON_DIMENSIONAL } from '../constants';
import options from '../options';


/** Create an element with the given nodeName.
 *	@param {String} nodeName
 *	@param {Boolean} [isSvg=false]	If `true`, creates an element within the SVG namespace.
 *	@returns {Element} node
 */
export function createNode(nodeName, isSvg) {
	// 创建一个给定的nodeName的element
	let node = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', nodeName) : document.createElement(nodeName);
	node.normalizedNodeName = nodeName;
	return node;
}


/** Remove a child node from its parent if attached.
 *  如果存在的话，从父节点那移除子节点
 *	@param {Element} node		The node to remove
 */
export function removeNode(node) {
	let parentNode = node.parentNode;
	if (parentNode) parentNode.removeChild(node);
}


/** Set a named attribute on the given Node, with special behavior for some names and event handlers.
 *  设置属性到给定的vnode， 对一些特殊的属性和事件处理做特殊的处理
 *	If `value` is `null`, the attribute/handler will be removed.
 	如果value是空的话，移除属性或者处理器
 *	@param {Element} node	An element to mutate 变化的节点
 *	@param {string} name	The name/key to set, such as an event or attribute name
 *	@param {any} old	The last value that was set for this name/node pair
 *	@param {any} value	An attribute value, such as a function to be used as an event handler
 *	@param {Boolean} isSvg	Are we currently diffing inside an svg?
 *	@private
 */
export function setAccessor(node, name, old, value, isSvg) {
	if (name==='className') name = 'class';


	if (name==='key') {
		// ignore
	}
	else if (name==='ref') {
		// preact的ref只支持函数，所以是这种写法
		if (old) old(null);
		if (value) value(node);
	}
	else if (name==='class' && !isSvg) {
		// 兼容class 和 className 两种写法
		node.className = value || '';
	}
	else if (name==='style') {
		if (!value || typeof value==='string' || typeof old==='string') {
			node.style.cssText = value || '';
		}
		if (value && typeof value==='object') {
			if (typeof old!=='string') {
				for (let i in old) if (!(i in value)) node.style[i] = '';
			}
			for (let i in value) {
				node.style[i] = typeof value[i]==='number' && IS_NON_DIMENSIONAL.test(i)===false ? (value[i]+'px') : value[i];
			}
		}
	}
	 // 
	else if (name==='dangerouslySetInnerHTML') {
		if (value) node.innerHTML = value.__html || '';
	}
	else if (name[0]=='o' && name[1]=='n') {
		// 对于事件的处理 onClick onChange etc事件
		// 是否使用事件捕获
		let useCapture = name !== (name=name.replace(/Capture$/, ''));
		name = name.toLowerCase().substring(2);
		if (value) {
			// 使用原生的事件进行代理，并且根据传过来的时候判断是否事件捕获
			if (!old) node.addEventListener(name, eventProxy, useCapture);
		}
		else {
			// 如果有key但是没有value那么就会移除事件监听
			node.removeEventListener(name, eventProxy, useCapture);
		}
		// 兼容性处理
		(node._listeners || (node._listeners = {}))[name] = value;
	}
	else if (name!=='list' && name!=='type' && !isSvg && name in node) {
		setProperty(node, name, value==null ? '' : value);
		if (value==null || value===false) node.removeAttribute(name);
	}
	else {
		let ns = isSvg && (name !== (name = name.replace(/^xlink\:?/, '')));
		if (value==null || value===false) {
			if (ns) node.removeAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase());
			else node.removeAttribute(name);
		}
		else if (typeof value!=='function') {
			if (ns) node.setAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase(), value);
			else node.setAttribute(name, value);
		}
	}
}


/** Attempt to set a DOM property to the given value.
 * 	设置property的值
 *	IE & FF throw for certain property-value combinations.
 */
function setProperty(node, name, value) {
	try {
		node[name] = value;
	} catch (e) { }
}


/** Proxy an event to hooked event handlers
 * 	// 当你触发一些事件的时候，会代理到这里, 相当于会有两次事件的触发，第一次就是浏览器dom事件 第二次
 *	@private
 */
function eventProxy(e) {
	return this._listeners[e.type](options.event && options.event(e) || e);
}
