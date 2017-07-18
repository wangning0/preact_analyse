import { VNode } from './vnode';
import options from './options';


const stack = [];

const EMPTY_CHILDREN = [];

/** JSX/hyperscript reviver
*	Benchmarks: https://esbench.com/bench/57ee8f8e330ab09900a1a1a0
 *	@see http://jasonformat.com/wtf-is-jsx
 *	@public
 */
export function h(nodeName, attributes) {
	let children=EMPTY_CHILDREN, lastSimple, child, simple, i;
	// 因为可能存在有很多个子dom节点的情况，就会超过三个参数
	for (i=arguments.length; i-- > 2; ) {
		stack.push(arguments[i]);
	}
	// props里面的childrne和dom节点的children一样的处理，放入一个stack中
	if (attributes && attributes.children!=null) {
		if (!stack.length) stack.push(attributes.children);
		delete attributes.children;
	}
	while (stack.length) {
		// 可能child也是一个数组的 pop方法只存在于数组当中
		if ((child = stack.pop()) && child.pop!==undefined) {
			for (i=child.length; i--; ) stack.push(child[i]);
		}
		else {
			if (typeof child==='boolean') child = null;
			// 因为nodename可能也是一个函数，h()这种的函数，即为一个模块名
			if ((simple = typeof nodeName!=='function')) {
				if (child==null) child = '';
				else if (typeof child==='number') child = String(child);
				// 判断child是不是一个普通的字符串
				else if (typeof child!=='string') simple = false;
			}

			if (simple && lastSimple) {
				children[children.length-1] += child;
			}
			else if (children===EMPTY_CHILDREN) {
				children = [child];
			}
			else {
				children.push(child);
			}

			lastSimple = simple;
		}
	}

	let p = new VNode();
	p.nodeName = nodeName; 
	p.children = children;
	p.attributes = attributes==null ? undefined : attributes;
	p.key = attributes==null ? undefined : attributes.key;

	// if a "vnode hook" is defined, pass every created VNode to it
	if (options.vnode!==undefined) options.vnode(p);

	return p;
}
