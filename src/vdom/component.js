import { SYNC_RENDER, NO_RENDER, FORCE_RENDER, ASYNC_RENDER, ATTR_KEY } from '../constants';
import options from '../options';
import { extend } from '../util';
import { enqueueRender } from '../render-queue';
import { getNodeProps } from './index';
import { diff, mounts, diffLevel, flushMounts, recollectNodeTree, removeChildren } from './diff';
import { createComponent, collectComponent } from './component-recycler';
import { removeNode } from '../dom';

/** Set a component's `props` (generally derived from JSX attributes).
 *	@param {Object} props
 *	@param {Object} [opts]
 *	@param {boolean} [opts.renderSync=false]	If `true` and {@link options.syncComponentUpdates} is `true`, triggers synchronous rendering.
 *	@param {boolean} [opts.render=true]			If `false`, no render will be triggered.
 */
// setComponentProps可以做一些记录在设置新的props时同时保存老的props
export function setComponentProps(component, props, opts, context, mountAll) {
	if (component._disable) return;
	component._disable = true;

	if ((component.__ref = props.ref)) delete props.ref;
	if ((component.__key = props.key)) delete props.key;
	// component.base 表示的是有没有挂载过，基准的dom点
	if (!component.base || mountAll) {
		// 生命周期内只执行一次
		if (component.componentWillMount) component.componentWillMount();
	}
	else if (component.componentWillReceiveProps) {
		component.componentWillReceiveProps(props, context);
	}
	// 上下文发生变化后，将重新定义上下文，并且原来的上下文为prevContext
	if (context && context!==component.context) {
		if (!component.prevContext) component.prevContext = component.context;
		component.context = context;
	}

	if (!component.prevProps) component.prevProps = component.props;
	component.props = props;

	component._disable = false;
	//	第一次的时候是不进行render的 只是单纯的设置component的props
	if (opts!==NO_RENDER) {
		if (opts===SYNC_RENDER || options.syncComponentUpdates!==false || !component.base) {
			renderComponent(component, SYNC_RENDER, mountAll);
		}
		else {
			enqueueRender(component);
		}
	}

	if (component.__ref) component.__ref(component); // ref引用
}



/** Render a Component, triggering necessary lifecycle events and taking High-Order Components into account.
 *  渲染组件，触发必要的生命周期事件，并且考虑高阶的组件
 *	@param {Component} component
 *	@param {Object} [opts]
 *	@param {boolean} [opts.build=false]		If `true`, component will build and store a DOM node if not already associated with one.
 *	@private
 */
export function renderComponent(component, opts, mountAll, isChild) {
	// 判断是否是卸载了的组件
	if (component._disable) return;

	let props = component.props,
		state = component.state,
		context = component.context,
		previousProps = component.prevProps || props,
		previousState = component.prevState || state,
		previousContext = component.prevContext || context,
		isUpdate = component.base, // 初始化的时候都是不存在的 非初始状态表示的是已经挂载了
		nextBase = component.nextBase, // 用处是 看该组件是否是已经存在过的 detail：component-recycler.js->createComponent	
		initialBase = isUpdate || nextBase,
		initialChildComponent = component._component, // 初始状态是为空, 非初始化状态则是子组件
		skip = false,
		rendered, inst, cbase;

	// if updating
	// 更新过的组件
	if (isUpdate) {
		// 因为是已经挂载后的组件，会出现进行前后props 和 state 的比较，所以这个时候需要把component的props和state和context变成上一次组件的状态
		component.props = previousProps;
		component.state = previousState;
		component.context = previousContext;
		// 判断是否需要update 性能优化点 如果是的话则跳过
		if (opts!==FORCE_RENDER
			&& component.shouldComponentUpdate
			&& component.shouldComponentUpdate(props, state, context) === false) {
			skip = true;
		}
		// componentWillUpdate生命周期
		else if (component.componentWillUpdate) {
			component.componentWillUpdate(props, state, context);
		}
		// 回归原状
		component.props = props;
		component.state = state;
		component.context = context;
	}

	component.prevProps = component.prevState = component.prevContext = component.nextBase = null;
	component._dirty = false; // 最后component都是false

	if (!skip) {
		// render渲染组件
		rendered = component.render(props, state, context);

		// context to pass to the child, can be updated via (grand-)parent component
		// 传递context 和react的方法类似
		if (component.getChildContext) {
			context = extend(extend({}, context), component.getChildContext());
		}

		let childComponent = rendered && rendered.nodeName, // 子组件
			toUnmount, base;
		// 如果元素是组件
		if (typeof childComponent==='function') {
			// 还是一个组件
			// set up high order component link

			let childProps = getNodeProps(rendered);
			inst = initialChildComponent;
			
			if (inst && inst.constructor===childComponent && childProps.key==inst.__key) {
				// 还是原来的子组件 component
				setComponentProps(inst, childProps, SYNC_RENDER, context, false);
			}
			else {
				// 如果不是原来的组件了，那就要把它卸载掉了
				toUnmount = inst;
				// 创建一个新的实例化的组件, 在这里赋值 _component
				component._component = inst = createComponent(childComponent, childProps, context);
				inst.nextBase = inst.nextBase || nextBase;
				inst._parentComponent = component;
				// 设置完了props之后在进行同步的渲染
				setComponentProps(inst, childProps, NO_RENDER, context, false);
				renderComponent(inst, SYNC_RENDER, mountAll, true);
			}

			base = inst.base;
		}
		else {
			// render后的不是一个组件
			cbase = initialBase;

			// destroy high order component link
			// 原来是组件，现在不是组件了，我要卸载你了
			toUnmount = initialChildComponent;
			if (toUnmount) {
				cbase = component._component = null;
			}

			if (initialBase || opts===SYNC_RENDER) {
				if (cbase) cbase._component = null;
				base = diff(cbase, rendered, context, mountAll || !isUpdate, initialBase && initialBase.parentNode, true);
			}
		}

		if (initialBase && base!==initialBase && inst!==initialChildComponent) {
			let baseParent = initialBase.parentNode;
			if (baseParent && base!==baseParent) {
				baseParent.replaceChild(base, initialBase);

				if (!toUnmount) {
					initialBase._component = null;
					recollectNodeTree(initialBase, false);
				}
			}
		}

		if (toUnmount) {
			unmountComponent(toUnmount);
		}

		component.base = base;
		if (base && !isChild) {
			let componentRef = component,
				t = component;
			while ((t=t._parentComponent)) {
				(componentRef = t).base = base;
			}
			base._component = componentRef;
			base._componentConstructor = componentRef.constructor;
		}
	}

	if (!isUpdate || mountAll) {
		// 进入队列等待执行 componentDidMount
		mounts.unshift(component);
	}
	else if (!skip) {
		// Ensure that pending componentDidMount() hooks of child components
		// are called before the componentDidUpdate() hook in the parent.
		// Note: disabled as it causes duplicate hooks, see https://github.com/developit/preact/issues/750
		// flushMounts();

		if (component.componentDidUpdate) {
			component.componentDidUpdate(previousProps, previousState, previousContext);
		}
		if (options.afterUpdate) options.afterUpdate(component);
	}

	if (component._renderCallbacks!=null) {
		while (component._renderCallbacks.length) component._renderCallbacks.pop().call(component);
	}

	if (!diffLevel && !isChild) flushMounts();
}



/** Apply the Component referenced by a VNode to the DOM.
 *  将vnode引用的组件应用于DOM
 *	@param {Element} dom	The DOM node to mutate 被变换的DOM节点
 *	@param {VNode} vnode	A Component-referencing VNode 引用组件的vnode
 *	@returns {Element} dom	The created/mutated element 
 *	@private
 */
// 主要做的事情是创造或者发现一个适合的component 实例，然后他要设置vnode上的attributes到组件实例上的props
export function buildComponentFromVNode(dom, vnode, context, mountAll) {
	// 初步想法 这个应该是dom里的component
	let c = dom && dom._component,
		originalComponent = c,
		oldDom = dom,
		// 是不是直属者
		isDirectOwner = c && dom._componentConstructor===vnode.nodeName,
		isOwner = isDirectOwner,
		props = getNodeProps(vnode);
		// 一层层的往上找，看是否是子孙元素
	while (c && !isOwner && (c=c._parentComponent)) {
		isOwner = c.constructor===vnode.nodeName;
	}
	// 组件存在，走更新组件的生命周期 
	if (c && isOwner && (!mountAll || c._component)) {
		setComponentProps(c, props, ASYNC_RENDER, context, mountAll);
		dom = c.base;
	}
	else {
		if (originalComponent && !isDirectOwner) {
			unmountComponent(originalComponent);
			dom = oldDom = null;
		}
		// 该组件不存在，创建一个新的组件
		c = createComponent(vnode.nodeName, props, context);
		// 要被替换的dom是否存在 并且 nextBase为false
		if (dom && !c.nextBase) {
			c.nextBase = dom;
			// passing dom/oldDom as nextBase will recycle it if unused, so bypass recycling on L229:
			// 如果dom/oldDom作为nextBase没有被使用的话，将会被回收
			oldDom = null;
		}
		setComponentProps(c, props, SYNC_RENDER, context, mountAll);
		dom = c.base;

		if (oldDom && dom!==oldDom) {
			oldDom._component = null;
			recollectNodeTree(oldDom, false);
		}
	}

	return dom;
}



/** Remove a component from the DOM and recycle it.
 * 	从DOM上移除一个组件 并且回收它， 参数是一个要卸载的组件实例
 *	@param {Component} component	The Component instance to unmount
 *	@private
 */
export function unmountComponent(component) {
	// 如果在options里面有beforeUnmount钩子函数，则执行
	if (options.beforeUnmount) options.beforeUnmount(component);

	let base = component.base;
	// component变得不可用
	component._disable = true;
	// 调用生命周期方法 componentWillUnmount 卸载前
	if (component.componentWillUnmount) component.componentWillUnmount();

	component.base = null;

	// recursively tear down & recollect high-order component children:
	let inner = component._component;
	if (inner) {
		unmountComponent(inner);
	}
	else if (base) {
		// react 规范 去掉ref的应用 而且preact的ref只支持函数类型
		if (base[ATTR_KEY] && base[ATTR_KEY].ref) base[ATTR_KEY].ref(null);

		component.nextBase = base;

		removeNode(base);
		collectComponent(component);

		removeChildren(base);
	}

	if (component.__ref) component.__ref(null);
}
