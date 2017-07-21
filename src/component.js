import { FORCE_RENDER } from './constants';
import { extend } from './util';
import { renderComponent } from './vdom/component';
import { enqueueRender } from './render-queue';

/** Base Component class.
 *  Component 基础类
 *	Provides `setState()` and `forceUpdate()`, which trigger rendering.
 	// 提供两个内置函数 setState forceUpdate 调用这两个函数的时候会触发渲染逻辑 rendering
 *	@public
 *
 *	@example
 *	class MyFoo extends Component {
 *		render(props, state) {
 *			return <div />;
 *		}
 *	}
 */
export function Component(props, context) {
	// 组件被创建初始化时  _dirty = true
	this._dirty = true;

	/** @public
	 *	@type {object}
	 */
	// 注入上下文
	this.context = context;

	/** @public
	 *	@type {object}
	 */
	// props属性注入
	this.props = props;

	/** @public
	 *	@type {object}
	 */
	// 注意这里的this是组件
	this.state = this.state || {};
}

// 放在prototype上，共享方法 ，好处大家都懂的
extend(Component.prototype, {

	/** Returns a `boolean` indicating if the component should re-render when receiving the given `props` and `state`.
	 *  优化 和react一样，判断是否进行渲染 ，避免不避免的渲染
	 *  nextProps nextState nextContext 和react不同之处在于这里可以有三个参数 多了一个context
	 *	@param {object} nextProps
	 *	@param {object} nextState
	 *	@param {object} nextContext
	 *	@returns {Boolean} should the component re-render
	 *	@name shouldComponentUpdate
	 *	@function
	 */


	/** Update component state by copying properties from `state` to `this.state`.
	 * 	更新组件的state 
	 *	@param {object} state		A hash of state properties to update with new values
	 *	@param {function} callback	A function to be called once component state is updated
	 */
	setState(state, callback) {
		let s = this.state;
		if (!this.prevState) this.prevState = extend({}, s);
		// state可以直接函数和对象两种方式
		extend(s, typeof state==='function' ? state(s, this.props) : state);
		// setState的回调函数会入栈
		if (callback) (this._renderCallbacks = (this._renderCallbacks || [])).push(callback);
		// 入栈渲染
		enqueueRender(this);
	},


	/** Immediately perform a synchronous re-render of the component
	 * 	将组件立刻同步进行重渲染 force强行来一波渲染把！
	 *	@param {function} callback		A function to be called after component is re-rendered.
	 *	@private
	 */
	forceUpdate(callback) {
		if (callback) (this._renderCallbacks = (this._renderCallbacks || [])).push(callback);
		renderComponent(this, FORCE_RENDER);
	},


	/** Accepts `props` and `state`, and returns a new Virtual DOM tree to build.
	 *	Virtual DOM is generally constructed via [JSX](http://jasonformat.com/wtf-is-jsx).
	 *	@param {object} props		Props (eg: JSX attributes) received from parent element/component
	 *	@param {object} state		The component's current state
	 *	@param {object} context		Context object (if a parent component has provided context)
	 *	@returns VNode
	 */
	render() {}

});
