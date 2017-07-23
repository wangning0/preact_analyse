/** Copy own-properties from `props` onto `obj`.
 *	@returns obj
 *	@private
 */
// 简单的对象的属性的复制
export function extend(obj, props) {
	for (let i in props) obj[i] = props[i];
	return obj;
}

/** Call a function asynchronously, as soon as possible.
 * // 调用异步函数，并且越快执行越好，只是为了性能 可以参考 asap这个库 
 *	@param {Function} callback
 */
export const defer = typeof Promise=='function' ? Promise.resolve().then.bind(Promise.resolve()) : setTimeout;
