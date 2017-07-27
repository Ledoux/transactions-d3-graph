import { drag } from 'd3-drag'
import { forceX,
  forceY,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation
} from 'd3-force'
import { event,
  select,
  selectAll
} from 'd3-selection'
import throttle from 'lodash.throttle'
import React, { Component } from 'react'

// SPECIAL EXCEPTION FOR FIREFOX SVG that
// have always clientWidth equal to zero for svg
function getClientWidth (element) {
  return element.clientWidth === 0
  ? (element.parentElement && element.parentElement.clientWidth) || 0
  : element.clientWidth
}

class GraphViz extends Component {
  constructor () {
    super()
    this.handleSetSimulation = this._handleSetSimulation.bind(this)
  }
  _handleSetSimulation () {
    const { call,
      simulation,
      vizHeight,
      vizSelection,
    } = this
    let { linksSelection,
      nodesSelection,
      vizWidth
    } = this
    const { collideRadius,
      fontFamily,
      fontSize,
      iconRatio,
      linkDistance,
      linkStrength,
      gravityStrength,
      isFromRandom,
      height,
      links,
      nodes,
      radius
    } = this.props
    // SPECIAL FIREFOX EXCEPTION
    const vizElement = document.querySelector('.graph-viz__svg')
    vizWidth = this.vizWidth = getClientWidth(vizElement)
    // prepare nodes
    if (isFromRandom) {
      nodes.forEach(node => {
        if (!node.x && !node.y) {
          node.x = Math.random() * vizWidth
          node.y = Math.random() * vizHeight
        }
      })
    }
    // stop simulation
    simulation.stop()
    // data
    nodesSelection = nodesSelection
      .data(nodes, d => d.id)
    nodesSelection.exit().remove()
    if (links && links.length > 0) {
      linksSelection = linksSelection
        .data(links, d => d.id)
      linksSelection.exit().remove()
    }
    // links
    if (links && links.length > 0) {
      this.linksSelection = linksSelection = linksSelection
        .enter()
        .append('g')
        .attr('class', d =>
          `g-link g-link--${d.sourceEntityName}-${d.targetEntityName}`
        )
        .append('line')
        .attr('stroke', 'black')
    }
    // we append the data into the selected elements
    this.nodesSelection = nodesSelection = nodesSelection
      .enter()
      .append('g')
      .attr('class', d => `g-node g-node--${d.entityName}`)
    // call for mouseover and mouseout
    if (call) {
      nodesSelection.call(call)
    }
    // append circle
    nodesSelection.append('circle')
      // radius is is important to set locally d.r in order to have a smart collideradius
      .attr('r', d => { d.r = radius; return d.r })
    // all
    const halfIconRatio = iconRatio / 2
    nodesSelection.append('use')
      .attr('xlink:href', d => `#${d.icon || d.entityName}`)
      .attr('width', d => iconRatio * d.r)
      .attr('height', d => iconRatio * d.r)
      .attr('transform', d => `translate(${-halfIconRatio * d.r},${-halfIconRatio * d.r})`)
    // update simulation
    simulation.nodes(nodes)
    // maybe this set needs a special collide
    simulation.force('collide', forceCollide().radius(d =>
      d.r + collideRadius)
     .iterations(2)
    )
    // center
    const centerCoordinates = [vizWidth / 2, height / 2]
    simulation.force('x', forceX(centerCoordinates[0])
      .strength(gravityStrength))
    simulation.force('y', forceY(centerCoordinates[1])
      .strength(gravityStrength))
    // links
    if (links && links.length > 0) {
      // force
      simulation.force('link', forceLink(links)
        .distance(linkDistance)
        .strength(linkStrength)
        .id(d => d.id))
    }
    // restart (by also reset the alpha to make the new nodes moving like a new start)
    simulation.alpha(1)
    // restart
    simulation.restart()
  }
  componentDidMount () {
    // unpack
    const { handleSetSimulation,
      updateNodes
    } = this
    const { alphaDecay,
      chargeStrength,
      gravityStrength,
      isDrag,
      isResize,
      height,
      nodes,
      onClick,
      onMouseOver,
      onMouseOut
    } = this.props
    // init svg
    const vizElement = this.vizElement = document
      .querySelector('.graph-viz__svg')
    const vizHeight = this.vizHeight = height
    const vizWidth = this.vizWidth = getClientWidth(vizElement)
    const vizSelection = this.vizSelection = select(vizElement)
    vizSelection.append('rect')
      .attr('class', 'g-overlay')
    // add nodes
    const nodesSelection = this.nodesSelection = vizSelection
      .selectAll('.g-node')
    // add links
    const linksSelection = this.linksSelection = vizSelection
      .selectAll('.g-link')
    // init simulation
    const simulation = this.simulation = forceSimulation()
     .alphaDecay(alphaDecay)
     .force('charge', forceManyBody().strength(chargeStrength))
     .on('tick', () => {
       // unpack
       const { linksSelection,
         nodesSelection
       } = this
       // transform
       nodesSelection
        .attr('transform', d => `translate(${d.x},${d.y})`)
       linksSelection
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)
     })
     .stop()
     // add drag option
     if (isDrag) {
      vizSelection.call(drag()
        .container(vizElement)
        .subject(() => simulation.find(event.x, event.y))
        .on('start', () => {
          if (!event.active) {
            simulation.alphaDecay(0.001)
            simulation.alphaTarget(0.3)
              .restart()
          }
          event.subject.fx = event.subject.x
          event.subject.fy = event.subject.y
        })
        .on('drag', () => {
          event.subject.fx = event.x
          event.subject.fy = event.y
        })
        .on('end', () => {
          if (!event.active) {
            simulation.alphaDecay(this.props.alphaDecay)
            simulation.alphaTarget(0)
          }
          event.subject.fx = null
          event.subject.fy = null
        })
      )
    }
    // add on options
    if (onClick) {
      this.onClick = (d) => {
        onClick(d)
      }
    }
    if (onMouseOver) {
      this.onMouseOver = (d) => {
        onMouseOver(d)
      }
    }
    if (onMouseOut) {
      this.onMouseOut = (d) => {
        onMouseOut(d)
      }
    }
    if (onClick || onMouseOver || onMouseOut) {
      this.call = a => {
        if (onMouseOver) {
          a.on('mouseover', onMouseOver)
        }
        if (onMouseOut) {
          a.on('mouseover', onMouseOut)
        }
        if (onClick) {
          a.on('click', onClick)
        }
      }
    }
    // add resize option
    if (isResize) {
      this._throttledResize = throttle(() => {
        simulation.stop()
        const vizWidth = this.vizWidth = getClientWidth(vizElement)
        const centerCoordinates = [vizWidth / 2, height /2]
        simulation.force('x', forceX(centerCoordinates[0])
          .strength(gravityStrength))
        simulation.force('y', forceY(centerCoordinates[1])
          .strength(gravityStrength))
        simulation.alpha(1)
        simulation.restart()
      }, 100)
      window.addEventListener('resize', this._throttledResize)
    }
    // set simulation if data is already there
    if (nodes) {
      handleSetSimulation()
    }
  }
  shouldComponentUpdate (nextProps) {
    const { nodes } = this.props
    return typeof nextProps.nodes !== 'undefined' && nextProps.nodes !== nodes
  }
  componentDidUpdate () {
    this.handleSetSimulation()
  }
  componentWillUnmount() {
    this.simulation.stop()
    window.removeEventListener('resize', this._throttledResize)
  }
  render () {
    const { height,
      width
    } = this.props
    return (<div className='graph-viz'>
      <svg
        className='graph-viz__svg'
        height={height}
        width={width}
      />
    </div>)
  }
}

GraphViz.defaultProps = { alphaDecay: 0.075,
  chargeStrength: 5,
  collideRadius: 10,
  fontFamily: 'Reval',
  fontSize: '14px',
  gravityStrength: 0.1,
  height: 350,
  iconRatio: 1.5,
  isDrag: true,
  isFromRandom: true,
  isResize: true,
  linkDistance: 0.5,
  linkStrength: 2,
  radius: 15,
  width: 500
}

export default GraphViz
