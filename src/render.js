import { diff } from './vdom/diff';

/** Render JSX into a `parent` Element.
 *	@param {VNode} vnode		A (JSX) VNode to render 需要被渲染的vnode
 *	@param {Element} parent		DOM element to render into 渲染在的dom element
 *	@param {Element} [merge]	Attempt to re-use an existing DOM tree rooted at `merge` 尝试去重新使用基于merge的DOM树
 *	@public
 *
 *	@example
 *	// render a div into <body>:
 *	render(<div id="hello">hello!</div>, document.body);
 *
 *	@example
 *	// render a "Thing" component into #foo:
 *	const Thing = ({ name }) => <span>{ name }</span>;
 *	render(<Thing name="one" />, document.querySelector('#foo'));
 */
// 分别表示的是vnode节点和挂载的节点所在位置
export function render(vnode, parent, merge) {
	// dom vnode ,context, mountAll, parent, componentRoot
	return diff(merge, vnode, {}, false, parent, false);
}
