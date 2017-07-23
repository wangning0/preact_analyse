import { ATTR_KEY } from '../constants';
import { isSameNodeType, isNamedNode } from './index';
import { buildComponentFromVNode } from './component';
import { createNode, setAccessor } from '../dom/index';
import { unmountComponent } from './component';
import options from '../options';
import { removeNode } from '../dom';

/** Queue of components that have been mounted and are awaiting componentDidMount */
export const mounts = [];

/** Diff recursion count, used to track the end of the diff cycle. */
// diff 递归技术，被用于跟踪diff cycle的结束
export let diffLevel = 0;

/** Global flag indicating if the diff is currently within an SVG */
// 全局flag用来说明是否diff是在一个svg里面
let isSvgMode = false;

/** Global flag indicating if the diff is performing hydration */
// 占坑
let hydrating = false;

/** Invoke queued componentDidMount lifecycle methods */
// 调用入队的componentDidMount生命周期方法
export function flushMounts() {
	let c;
	while ((c=mounts.pop())) {
		// 如果有hook函数，可以触发该方法
		if (options.afterMount) options.afterMount(c);
		//存在componentDidMount则调用该生命周期函数， dom挂载完毕 该方法是在diff内调用
		if (c.componentDidMount) c.componentDidMount();
	}
}


/** Apply differences in a given vnode (and it's deep children) to a real DOM Node.
 * 	将比较后的差异应用到真实的dom节点中，并且会递归子节点
 *	@param {Element} [dom=null]		A DOM node to mutate into the shape of the `vnode`
 *	@param {VNode} vnode			A VNode (with descendants forming a tree) representing the desired DOM structure
 *	@returns {Element} dom			The created/mutated element
 *	@private
 */
// diff做了些操作记录去跟踪我们干什么
export function diff(dom, vnode, context, mountAll, parent, componentRoot) {
	// diffLevel having been 0 here indicates initial entry into the diff (not a subdiff)
	// diffLevel被设置为0表示的是初始化进入diff
	if (!diffLevel++) {
		// when first starting the diff, check if we're diffing an SVG or within an SVG
		// 当第一次开始diff时候，检查是否是diff一个svg或者是在svg内部
		isSvgMode = parent!=null && parent.ownerSVGElement!==undefined;

		// hydration is indicated by the existing element to be diffed not having a prop cache
		// hydration是根据存在的要被diff的元素没有一个prop缓存 
		// 这一块还需要做一些记录
		hydrating = dom!=null && !(ATTR_KEY in dom);
	}
	// 调用idiff来实际执行实际的diff
	let ret = idiff(dom, vnode, context, mountAll, componentRoot);

	// append the element if its a new parent
	// 将idiff返回的node结果放入到parent中, 并且是新的parent
	if (parent && ret.parentNode!==parent) parent.appendChild(ret);

	// diffLevel being reduced to 0 means we're exiting the diff
	// diffLevel 被减少到0意味着我们在退出diff环节
	if (!--diffLevel) {
		hydrating = false;
		// invoke queued componentDidMount lifecycle methods
		// componentRoot 的作用还不明确，后续跟进
		if (!componentRoot) flushMounts();
	}

	return ret;
}


/** Internals of `diff()`, separated to allow bypassing diffLevel / mount flushing. */
// diff 内部函数，
function idiff(dom, vnode, context, mountAll, componentRoot) {
	let out = dom,
		prevSvgMode = isSvgMode;

	// empty values (null, undefined, booleans) render as empty Text nodes
	// 空值渲染出一个空的Text 节点
	if (vnode==null || typeof vnode==='boolean') vnode = '';

	// 如果vnode是string 或者是number则创建或者更新 Text nodes
	// 但是什么时候vnode会是一个string/ number 呢??
	// 主要是因为可能会存在这样的返回的vnode
	/*
		{
			nodeName: 'div',
			attributes: {id: 'foo'},
			children:[
				"hello",
				{
					nodeName: 'br'
				}
			]
		}
		在进行children的遍历的时候就会有vnode是以一个string / number 这样的形式出现，所以是一个优化手段
	*/
	// 一个优化手段
	// Fast case: Strings & Numbers create/update Text nodes.
	if (typeof vnode==='string' || typeof vnode==='number') {

		// update if it's already a Text node:
		// 如果他是一个存在的Text node那么就更新它 splitText的作用就是用来鉴定是不是textnode
		// 为什么会在这里会使用splitText来鉴定是不是textnode呢？是因为性能原因，https://esbench.com/bench/58aba6b199634800a03478d9
		// 可以通过这个来看 性能的比较
		if (dom && dom.splitText!==undefined && dom.parentNode && (!dom._component || componentRoot)) {
			/* istanbul ignore if */ /* Browser quirk that can't be covered: https://github.com/developit/preact/commit/fd4f21f5c45dfd75151bd27b4c217d8003aa5eb9 */
			if (dom.nodeValue!=vnode) {
				dom.nodeValue = vnode;
			}
		}
		else {
			// it wasn't a Text node: replace it with one and recycle the old Element
			// 如果不是一个Text node， 用一个代替它，并且回收老的element
			out = document.createTextNode(vnode);
			if (dom) {
				if (dom.parentNode) dom.parentNode.replaceChild(out, dom);
				// 递归回收节点树 执行生命周期
				recollectNodeTree(dom, true);
			}
		}

		// __preactattr_
		out[ATTR_KEY] = true;

		return out;
	}


	// If the VNode represents a Component, perform a component diff:
	// 如果vnode表示的是一个组件，执行组件差异
	let vnodeName = vnode.nodeName;
	if (typeof vnodeName==='function') {
		// 如果vnodeName还是一个组件的话 该方法会为一个组件创造一个virtual dom
		return buildComponentFromVNode(dom, vnode, context, mountAll);
	}


	// Tracks entering and exiting SVG namespace when descending through the tree.
	isSvgMode = vnodeName==='svg' ? true : vnodeName==='foreignObject' ? false : isSvgMode;


	// If there's no existing element or it's the wrong type, create a new one:
	vnodeName = String(vnodeName);
	if (!dom || !isNamedNode(dom, vnodeName)) {
		out = createNode(vnodeName, isSvgMode);

		if (dom) {
			// move children into the replacement node
			while (dom.firstChild) out.appendChild(dom.firstChild);

			// if the previous Element was mounted into the DOM, replace it inline
			if (dom.parentNode) dom.parentNode.replaceChild(out, dom);

			// recycle the old element (skips non-Element node types)
			recollectNodeTree(dom, true);
		}
	}


	let fc = out.firstChild,
		props = out[ATTR_KEY],
		vchildren = vnode.children;

	if (props==null) {
		props = out[ATTR_KEY] = {};
		for (let a=out.attributes, i=a.length; i--; ) props[a[i].name] = a[i].value;
	}

	// Optimization: fast-path for elements containing a single TextNode:
	if (!hydrating && vchildren && vchildren.length===1 && typeof vchildren[0]==='string' && fc!=null && fc.splitText!==undefined && fc.nextSibling==null) {
		// 针对textNode进行了优化
		if (fc.nodeValue!=vchildren[0]) {
			fc.nodeValue = vchildren[0];
		}
	}
	// otherwise, if there are existing or new children, diff them:
	else if (vchildren && vchildren.length || fc!=null) {
		innerDiffNode(out, vchildren, context, mountAll, hydrating || props.dangerouslySetInnerHTML!=null);
	}


	// Apply attributes/props from VNode to the DOM Element:
	// 对attributes 进行diff
	diffAttributes(out, vnode.attributes, props);


	// restore previous SVG mode: (in case we're exiting an SVG namespace)
	isSvgMode = prevSvgMode;

	return out;
}


/** Apply child and attribute changes between a VNode and a DOM Node to the DOM.
 * 	将vnode和dom节点的子节点和属性的变化 反馈到真实的dom上
 *	@param {Element} dom			Element whose children should be compared & mutated 需要比较的dom
 *	@param {Array} vchildren		Array of VNodes to compare to `dom.childNodes` 和dom.childNodes比较的VNodes
 *	@param {Object} context			Implicitly descendant context object (from most recent `getChildContext()`)
 *	@param {Boolean} mountAll
 *	@param {Boolean} isHydrating	If `true`, consumes externally created elements similar to hydration
 */
function innerDiffNode(dom, vchildren, context, mountAll, isHydrating) {
	let originalChildren = dom.childNodes,
		children = [],
		keyed = {},
		keyedLen = 0,
		min = 0,
		len = originalChildren.length, // dom的子节点数
		childrenLen = 0,
		vlen = vchildren ? vchildren.length : 0,
		j, c, f, vchild, child;

	// Build up a map of keyed children and an Array of unkeyed children:
	// 构造没有key值和有key值的map
	if (len!==0) {
		for (let i=0; i<len; i++) {
			let child = originalChildren[i],
				props = child[ATTR_KEY],
				key = vlen && props ? child._component ? child._component.__key : props.key : null;
				// 有key的情况
			if (key!=null) {
				keyedLen++;
				keyed[key] = child;
			}
			// 没有key的情况
			else if (props || (child.splitText!==undefined ? (isHydrating ? child.nodeValue.trim() : true) : isHydrating)) {
				children[childrenLen++] = child;
			}
		}
	}

	if (vlen!==0) {
		for (let i=0; i<vlen; i++) {
			vchild = vchildren[i];
			child = null;

			// attempt to find a node based on key matching
			let key = vchild.key;
			if (key!=null) {
				if (keyedLen && keyed[key]!==undefined) {
					child = keyed[key];
					keyed[key] = undefined;
					keyedLen--;
				}
			}
			// attempt to pluck a node of the same type from the existing children
			// 对于没有key的情况
			else if (!child && min<childrenLen) {
				for (j=min; j<childrenLen; j++) {
					if (children[j]!==undefined && isSameNodeType(c = children[j], vchild, isHydrating)) {
						child = c;
						children[j] = undefined;
						if (j===childrenLen-1) childrenLen--;
						if (j===min) min++;
						break;
					}
				}
			}

			// morph the matched/found/created DOM child to match vchild (deep)
			// diff产生child
			child = idiff(child, vchild, context, mountAll);
			// 对dom的操作都在这里
			f = originalChildren[i];
			if (child && child!==dom && child!==f) {
				if (f==null) {
					dom.appendChild(child);
				}
				else if (child===f.nextSibling) {
					removeNode(f);
				}
				else {
					dom.insertBefore(child, f);
				}
			}
		}
	}


	// remove unused keyed children:
	if (keyedLen) {
		for (let i in keyed) if (keyed[i]!==undefined) recollectNodeTree(keyed[i], false);
	}

	// remove orphaned unkeyed children:
	while (min<=childrenLen) {
		if ((child = children[childrenLen--])!==undefined) recollectNodeTree(child, false);
	}
}



/** Recursively recycle (or just unmount) a node and its descendants.
 * 	递归回收或者只是卸载一个节点以及它的后代
 *	@param {Node} node						DOM node to start unmount/removal from   DOM节点开始删除或卸载
 *	@param {Boolean} [unmountOnly=false]	If `true`, only triggers unmount lifecycle, skips removal 为真的话，只会触发卸载的生命周期，跳过removal
 */
export function recollectNodeTree(node, unmountOnly) {
	let component = node._component;
	if (component) {
		// if node is owned by a Component, unmount that component (ends up recursing back here)
		// 如果该node是在组件持有的，卸载该组件，在此处递归结束
		unmountComponent(component);
	}
	else {
		// If the node's VNode had a ref function, invoke it with null here.
		// (this is part of the React spec, and smart for unsetting references)
		// React的规范的一部分，利于去取消引用 references
		if (node[ATTR_KEY]!=null && node[ATTR_KEY].ref) node[ATTR_KEY].ref(null);
		// 
		if (unmountOnly===false || node[ATTR_KEY]==null) {
			removeNode(node);
		}

		removeChildren(node);
	}
}

/**
 * 优化的点：
 * 	使用lastChild可以比firstChild减少重绘的次数，提升性能
 *  而且比调用childNodes性能也更好
 */
/** Recollect/unmount all children.
 *	- we use .lastChild here because it causes less reflow than .firstChild
 *	- it's also cheaper than accessing the .childNodes Live NodeList
 */
// 递归移除节点
export function removeChildren(node) {
	node = node.lastChild;
	while (node) {
		let next = node.previousSibling;
		recollectNodeTree(node, true);
		node = next;
	}
}


/** Apply differences in attributes from a VNode to the given DOM Element.
 *  将属性的区别从vnode应用到给定的DOM节点
 *	@param {Element} dom		Element with attributes to diff `attrs` against  和attrs去比较的带有attributes的element
 *	@param {Object} attrs		The desired end-state key-value attribute pairs
 *	@param {Object} old			Current/previous attributes (from previous VNode or element's prop cache)
 */
function diffAttributes(dom, attrs, old) {
	let name;

	// remove attributes no longer present on the vnode by setting them to undefined
	// 设置不在vnode中存在的属性为空来删除它们
	for (name in old) {
		if (!(attrs && attrs[name]!=null) && old[name]!=null) {
			setAccessor(dom, name, old[name], old[name] = undefined, isSvgMode);
		}
	}

	// add new & update changed attributes
	// 增加新的或者更新改变的属性
	for (name in attrs) {
		if (name!=='children' && name!=='innerHTML' && (!(name in old) || attrs[name]!==(name==='value' || name==='checked' ? dom[name] : old[name]))) {
			setAccessor(dom, name, old[name], old[name] = attrs[name], isSvgMode);
		}
	}
}
